import { useMemo, useRef, useState } from "react";
import useEventSource from "../hooks/useEventSource";
import { sseUrl, API_BASE_URL } from "../api";

const API = API_BASE_URL;

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
  const [modeNote, setModeNote] = useState("");

  const gotLiveDataRef = useRef(false);
  const fallbackTriggeredRef = useRef(false);
  const terminatedRef = useRef(false);

  const liveUrl = useMemo(
    () => (isLive ? `${API}/scripts/run/${selected}/stream` : ""),
    [isLive, selected]
  );

  const esCtrl = useEventSource(liveUrl, {
    enabled: !!liveUrl,
    onOpen: () => {
      gotLiveDataRef.current = false;
      terminatedRef.current = false;
      setModeNote(`Streaming (${selected}) via SSE`);
      // Fallback timer if no data
      window.setTimeout(async () => {
        if (!isLive) return;
        if (!gotLiveDataRef.current && !fallbackTriggeredRef.current) {
          fallbackTriggeredRef.current = true;
          append(`[FALLBACK] No stream data quickly; switching to POST.`);
          setIsLive(false);
          esCtrl.close();
          await runViaPost(selected, { annotate: "Fallback: stream inactive." });
        }
      }, 1200);
    },
    onMessage: (line) => {
      gotLiveDataRef.current = true;
      if (line && /^\[exit\s+\d+\]$/.test(line.trim())) {
        append(line);
        append("✅ Finished.");
        terminatedRef.current = true;
        setIsLive(false);
        esCtrl.close();
        setBusy(false);
        return;
      }
      append(line);
    },
    onError: async () => {
      if (terminatedRef.current) return;
      if (gotLiveDataRef.current) {
        append("✅ Finished (stream closed).");
        terminatedRef.current = true;
        setIsLive(false);
        esCtrl.close();
        setBusy(false);
        return;
      }
      if (!fallbackTriggeredRef.current) {
        fallbackTriggeredRef.current = true;
        append("[FALLBACK] Stream error; switching to POST.");
        setIsLive(false);
        esCtrl.close();
        await runViaPost(selected, { annotate: "Fallback: SSE error." });
      }
    },
  });

  function append(line) {
    setLiveLines((prev) => [...prev, line]);
  }

  function resetLive() {
    setLiveLines([]);
    setModeNote("");
    gotLiveDataRef.current = false;
    fallbackTriggeredRef.current = false;
    terminatedRef.current = false;
  }

  function stopLive() {
    setIsLive(false);
    terminatedRef.current = true;
    esCtrl.close();
    append("⏹️ Live stream closed.");
    setBusy(false);
  }

  async function startAndStream() {
    resetLive();
    append(`▶ Starting ${selected} (SSE)…`);
    setIsLive(true);
    setBusy(true);
  }

  async function runViaPost(scriptKey, options = {}) {
    try {
      setBusy(true);
      const url = sseUrl(`/scripts/run/${scriptKey}`);
      setModeNote(`POST fallback (${scriptKey})`);
      append(`▶ POST ${url}`);
      const res = await fetch(url, { method: "POST" });
      let json = {};
      try {
        json = await res.json();
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        append(
          `❌ POST failed (${res.status}) ${
            json.output?.trim() || res.statusText || "Unknown error"
          }`
        );
        terminatedRef.current = true;
        return;
      }
      const raw = json?.output ? json.output : "Started.";
      const lines = raw.split("\n");
      if (options.annotate) append(options.annotate);
      lines.forEach((l) => append(l));
      append("✅ Finished (POST).");
      terminatedRef.current = true;
    } catch (e) {
      append(`❌ POST start failed: ${String(e.message || e)}`);
    } finally {
      setBusy(false);
      setIsLive(false);
      esCtrl.close();
    }
  }

  async function runNoStream() {
    if (isLive) stopLive();
    resetLive();
    await runViaPost(selected);
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Script executor</h2>
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

          {!isLive && (
            <button
              className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
              onClick={startAndStream}
              disabled={busy}
            >
              Start & Stream
            </button>
          )}
          {isLive && (
            <button
              className="px-3 py-1 rounded bg-gray-200 text-gray-800 disabled:opacity-50"
              onClick={stopLive}
              disabled={!isLive}
            >
              Stop
            </button>
          )}
          <button
            className="px-3 py-1 rounded bg-slate-700 text-white disabled:opacity-50"
            onClick={runNoStream}
            disabled={isLive || busy}
          >
            Run (no stream)
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Primary: SSE GET /scripts/run/{{script}}/stream → fallback: POST /scripts/run/{{script}}.
        </p>
        {modeNote && (
          <p className="text-xs mt-1 text-indigo-600 font-mono">{modeNote}</p>
        )}

        <div className="mt-3 h-[60vh] overflow-auto whitespace-pre-wrap font-mono rounded border border-gray-200 bg-gray-50 p-3 text-xs">
          {liveLines.length === 0 && (
            <div className="text-gray-400">No output yet.</div>
          )}
          {liveLines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}