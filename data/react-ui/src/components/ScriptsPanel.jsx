import { useState } from "react";

const scripts = [
  { label: "Fast Host Scan", key: "scan-hosts-fast" },
  { label: "Deep Host Scan", key: "scan-hosts-deep" },
  { label: "Scan Docker", key: "scan-docker" },
];

export function ScriptsPanel() {
  const [running, setRunning] = useState(null);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const runScript = async (scriptKey) => {
    setRunning(scriptKey);
    setOutput("");
    setError("");

    try {
      const res = await fetch(`/api/scripts/run/${scriptKey}`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setOutput(data.output || "Script executed successfully.");
      } else {
        setError(data.output || "Script failed to execute.");
      }
    } catch (err) {
      setError("Network error or backend is unreachable.");
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="p-6 bg-white rounded shadow space-y-4 relative">
      <h2 className="text-lg font-semibold">Script Executor</h2>

      {/* Progress Bar */}
      {running && (
        <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400 animate-pulse rounded absolute top-0 left-0"></div>
      )}

      <div className="space-y-2 mt-2">
        {scripts.map((script) => (
          <button
            key={script.key}
            onClick={() => runScript(script.key)}
            disabled={running !== null}
            className={`w-full px-4 py-2 rounded ${
              running === script.key
                ? "bg-gray-400 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {running === script.key ? `Running ${script.label}...` : script.label}
          </button>
        ))}
      </div>

      {output && (
        <div className="mt-4 p-3 bg-green-100 text-green-800 border border-green-300 rounded text-sm whitespace-pre-wrap">
          <strong>Output:</strong>
          <br />
          {output}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-800 border border-red-300 rounded text-sm whitespace-pre-wrap">
          <strong>Error:</strong>
          <br />
          {error}
        </div>
      )}
    </div>
  );
}
