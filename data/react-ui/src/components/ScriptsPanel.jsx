import React, { useMemo, useRef, useState, useEffect } from "react";
import useEventSource from "../hooks/useEventSource";

// Script executor with live output only
// - Primary: stream from GET /api/scripts/run/{script}/stream (if backend supports it)
// - Fallback: POST /api/scripts/run/{script} and display the response output

import { apiGet, apiPost } from "../api"; // NEW: centralized API helper (uses VITE_ envs)

const API = "/api";

const SCRIPTS = [
  { key: "scan-hosts-fast", label: "Fast Scan" },
  { key: "scan-hosts-deep", label: "Deep Scan" },
  { key: "scan-docker", label: "Docker Scan" },
];

export function ScriptsPanel() {
  const [selected, setSelected] = useState(SCRIPTS[0].key);
  const [liveLines, setLiveLines] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [busy, setBusy] = useState(false);
  
  // Scheduler state
  const [schedulerConfig, setSchedulerConfig] = useState(null);
  const [schedulerInterval, setSchedulerInterval] = useState(60);
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  const [schedulerSaving, setSchedulerSaving] = useState(false);

  // Refs to avoid stale closures and to control single-fallback behavior
  const gotLiveDataRef = useRef(false);
  const fallbackTriggeredRef = useRef(false);
  const terminatedRef = useRef(false); // set when we decide the run is finished
  
  // Load scheduler config on mount
  useEffect(() => {
    loadSchedulerConfig();
  }, []);
  
  async function loadSchedulerConfig() {
    try {
      const config = await apiGet("/scheduler/config");
      setSchedulerConfig(config);
      setSchedulerInterval(config.scan_interval_minutes);
      setSchedulerEnabled(config.enabled);
    } catch (e) {
      console.error("Failed to load scheduler config:", e);
    }
  }
  
  async function saveSchedulerConfig() {
    try {
      setSchedulerSaving(true);
      const response = await fetch(`${API}/scheduler/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scan_interval_minutes: schedulerInterval,
          enabled: schedulerEnabled
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save: ${response.statusText}`);
      }
      
      await loadSchedulerConfig();
      alert("Scheduler configuration saved successfully!");
    } catch (e) {
      console.error("Failed to save scheduler config:", e);
      alert("Failed to save scheduler configuration: " + e.message);
    } finally {
      setSchedulerSaving(false);
    }
  }

  // Primary live streaming URL (starts the scan and streams)
  const liveUrl = useMemo(
    () => (isLive ? `${API}/scripts/run/${selected}/stream` : ""),
    [isLive, selected]
  );

  // Open the EventSource and keep a controller so we can close it explicitly
  const esCtrl = useEventSource(liveUrl, {
    enabled: !!liveUrl,
    onOpen: () => {
      // reset runtime flags on open
      gotLiveDataRef.current = false;
      terminatedRef.current = false;

      // If the stream doesn't start producing quickly, try fallback once
      window.setTimeout(async () => {
        if (!isLive) return; // user may have stopped
        if (!gotLiveDataRef.current && !fallbackTriggeredRef.current) {
          fallbackTriggeredRef.current = true;
          // Ensure we stop the ES before switching to POST
          setIsLive(false);
          esCtrl.close();
          await runViaPost(selected, { annotate: "Fallback: stream not available, started via POST." });
        }
      }, 1200);
    },
    onMessage: (line) => {
      gotLiveDataRef.current = true;

      // Detect completion marker (your backend can emit "[exit 0]" when done)
      if (line && /^\[exit\s+\d+\]$/.test(line.trim())) {
        setLiveLines((prev) => [...prev, line, "✅ Finished."]);
        terminatedRef.current = true;
        setIsLive(false); // triggers cleanup and closes ES
        esCtrl.close();
        return;
      }

      setLiveLines((prev) => [...prev, line]);
    },
    onError: async () => {
      // If we've explicitly terminated (saw exit or decided finished), ignore errors
      if (terminatedRef.current) return;

      // If we already received some data and the stream ends/errs, treat it as normal end
      if (gotLiveDataRef.current) {
        setLiveLines((prev) => [...prev, "✅ Finished."]);
        terminatedRef.current = true;
        setIsLive(false);
        esCtrl.close();
        return;
      }

      // No data yet: trigger the POST fallback once
      if (!fallbackTriggeredRef.current) {
        fallbackTriggeredRef.current = true;
        setIsLive(false);
        esCtrl.close();
        await runViaPost(selected, { annotate: "Fallback: stream error, started via POST." });
      }
      // else: do nothing (avoid repeated messages)
    },
  });

  function resetLive() {
    setLiveLines([]);
    gotLiveDataRef.current = false;
    fallbackTriggeredRef.current = false;
    terminatedRef.current = false;
  }

  function stopLive() {
    setIsLive(false);
    terminatedRef.current = true;
    esCtrl.close();
    setLiveLines((prev) => [...prev, "⏹️ Live stream closed."]);
  }

  async function startAndStream() {
    resetLive();
    setIsLive(true);
  }

  // Fallback path: POST to start the script, then display HTTP response output (no tailing here)
  async function runViaPost(scriptKey, options = {}) {
    try {
      setBusy(true);
      const res = await fetch(`${API}/scripts/run/${scriptKey}`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLiveLines((prev) => [...prev, `POST failed: ${json.output || res.statusText}`]);
        return;
      }

      const lines = (json?.output ? json.output : "Started.").split("\n");
      const annotate = options.annotate ? [options.annotate] : [];
      setLiveLines((prev) => [...prev, ...annotate, ...lines]);

      // Mark as finished since POST is not a stream
      terminatedRef.current = true;
      setIsLive(false);
      esCtrl.close();
    } catch (e) {
      setLiveLines((prev) => [...prev, `POST start failed: ${String(e)}`]);
    } finally {
      setBusy(false);
    }
  }

  // "Run (no stream)" just uses POST without trying to open SSE
  async function runNoStream() {
    // Ensure we are not in live mode
    if (isLive) stopLive();
    resetLive();
    await runViaPost(selected);
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Scheduler Configuration Panel */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">⏰ Auto-Scan Scheduler</h2>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={schedulerEnabled}
              onChange={(e) => setSchedulerEnabled(e.target.checked)}
              disabled={schedulerSaving}
              className="h-4 w-4"
            />
            <span className="font-medium">Enable automatic scans</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="font-medium">Run scans every</label>
          <input
            type="number"
            min="1"
            max="10080"
            value={schedulerInterval}
            onChange={(e) => setSchedulerInterval(parseInt(e.target.value) || 1)}
            disabled={schedulerSaving}
            className="border rounded px-2 py-1 w-20"
          />
          <span className="font-medium">minutes</span>
          <button
            className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
            onClick={saveSchedulerConfig}
            disabled={schedulerSaving}
          >
            {schedulerSaving ? "Saving..." : "Save"}
          </button>
        </div>
        {schedulerConfig && schedulerConfig.last_run && (
          <p className="text-xs text-gray-500 mt-2">
            Last scheduled run: {new Date(schedulerConfig.last_run).toLocaleString()}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          The scheduler runs all three scans (fast, docker, deep) automatically at the configured interval.
          You can also set the interval via the ATLAS_SCAN_INTERVAL environment variable (in minutes).
        </p>
      </div>

      {/* Script executor panel */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">🚀 Manual Script Executor</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="font-medium">Script</label>
          <select
            className="border rounded px-2 py-1"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={isLive || busy}
          >
            {SCRIPTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label} ({s.key})
              </option>
            ))}
          </select>

          <button
            className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
            onClick={startAndStream}
            disabled={isLive || busy}
          >
            Start & Stream
          </button>
          <button
            className="px-3 py-1 rounded bg-gray-200 text-gray-800 disabled:opacity-50"
            onClick={stopLive}
            disabled={!isLive}
          >
            Stop
          </button>
          <button
            className="px-3 py-1 rounded bg-slate-700 text-white disabled:opacity-50"
            onClick={runNoStream}
            disabled={isLive || busy}
          >
            Run (no stream)
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Primary: GET /api/scripts/run/{"{script}"}/stream. Fallback: POST /api/scripts/run/{"{script}"} (no tailing here).
        </p>

        <div className="mt-3 h-[60vh] overflow-auto whitespace-pre-wrap font-mono rounded border border-gray-200 bg-gray-50 p-3">
          {liveLines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}