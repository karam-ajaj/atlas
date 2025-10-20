import React, { useState, useEffect } from "react";
import { apiGet, apiPost } from "../api";

export function SettingsPanel() {
  const [scanInterval, setScanInterval] = useState(30);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadScanInterval();
  }, []);

  async function loadScanInterval() {
    try {
      setLoading(true);
      const data = await apiGet("/config/scan-interval");
      setScanInterval(data.interval_minutes || 30);
      setError("");
    } catch (e) {
      setError(`Failed to load scan interval: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveScanInterval() {
    try {
      setLoading(true);
      setMessage("");
      setError("");
      
      const data = await apiPost("/config/scan-interval", {
        json: { interval_minutes: parseInt(scanInterval, 10) },
      });
      
      setMessage(
        `Scan interval updated to ${data.interval_minutes} minutes. ${data.note || ""}`
      );
    } catch (e) {
      setError(`Failed to update scan interval: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-md font-medium mb-2">Auto Scan Configuration</h3>
            <div className="flex items-center gap-3">
              <label className="font-medium text-sm">Scan Interval (minutes):</label>
              <input
                type="number"
                className="border rounded px-3 py-2 w-32"
                value={scanInterval}
                onChange={(e) => setScanInterval(e.target.value)}
                min="1"
                max="1440"
                disabled={loading}
              />
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700"
                onClick={saveScanInterval}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 disabled:opacity-50 hover:bg-gray-300"
                onClick={loadScanInterval}
                disabled={loading}
              >
                Reload
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Set how often Atlas should automatically scan your network (1-1440 minutes).
              Default is 30 minutes.
            </p>
          </div>

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
              <p className="text-sm">{message}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="text-md font-medium mb-2">About Auto-Scan</h3>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Auto-scan runs fastscan, dockerscan, and deepscan in sequence</li>
              <li>Changes take effect after restarting the container</li>
              <li>For persistent changes, set SCAN_INTERVAL_MINUTES environment variable when starting the container</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
