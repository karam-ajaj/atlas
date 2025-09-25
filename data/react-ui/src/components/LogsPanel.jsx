import { useEffect, useState, useRef, useMemo } from "react";
import { apiGet, sseUrl, API_BASE_URL } from "../api";

export function LogsPanel() {
  const [logFiles, setLogFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [logLines, setLogLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const eventSourceRef = useRef(null);
  const seenLinesRef = useRef(new Set());

  // Initial load of log list
  useEffect(() => {
    let aborted = false;
    apiGet("/logs/list")
      .then((files) => {
        if (aborted) return;
        setLogFiles(files || []);
        if (files && files.length > 0) setSelectedFile(files[0]);
      })
      .catch(() => {
        if (!aborted) setLogFiles([]);
      });
    return () => { aborted = true; };
  }, []);

  // Selected file label for display and tooltip
  const selectedLabel = useMemo(() => {
    if (!selectedFile) return "";
    return selectedFile.startsWith("container:")
      ? `(Container) ${selectedFile.replace("container:", "")}`
      : selectedFile;
  }, [selectedFile]);

  // Load / stream a specific log
  useEffect(() => {
    if (!selectedFile) return;

    // Cleanup any previous stream
    if (eventSourceRef.current) {
      try { eventSourceRef.current.close(); } catch {}
      eventSourceRef.current = null;
    }

    seenLinesRef.current = new Set();
    setLogLines([]);
    setLoading(true);

    const enc = encodeURIComponent(selectedFile);

    if (streaming) {
      const es = new EventSource(sseUrl(`/logs/${enc}/stream`));
      es.onmessage = (event) => {
        const line = (event.data ?? "").trim();
        if (!seenLinesRef.current.has(line)) {
          seenLinesRef.current.add(line);
          setLogLines((prev) => [...prev.slice(-500), line]);
        }
      };
      es.onerror = () => {
        try { es.close(); } catch {}
        eventSourceRef.current = null;
      };
      eventSourceRef.current = es;
      setLoading(false);
    } else {
      apiGet(`/logs/${enc}`)
        .then((data) => {
          const lines = (data?.content || "").split("\n");
          lines.forEach((line) => seenLinesRef.current.add(line));
          setLogLines(lines.slice(-500));
        })
        .catch(() => {
          setLogLines(["[ERROR] Failed to load log"]);
        })
        .finally(() => setLoading(false));
    }

    return () => {
      if (eventSourceRef.current) {
        try { eventSourceRef.current.close(); } catch {}
        eventSourceRef.current = null;
      }
    };
  }, [selectedFile, streaming]);

  const handleDownload = () => {
    if (!selectedFile) return;
    const enc = encodeURIComponent(selectedFile);
    const link = document.createElement("a");
    // Use absolute API base (was /api/logs/... before)
    link.href = `${API_BASE_URL}/logs/${enc}/download`;
    link.download = selectedFile;
    link.click();
  };

  const highlightMatch = (line) => {
    if (!searchTerm) return line;
    // Escape RegExp special chars in searchTerm
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = line.split(new RegExp(`(${escaped})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <span key={i} className="bg-yellow-300 text-black px-1 rounded">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className="p-4 bg-gray-900 text-green-300 font-mono rounded shadow h-full flex flex-col space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-white shrink-0">Select Log:</label>

        <div className="flex-1 min-w-[220px] max-w-[50%]">
          <select
            title={selectedLabel}
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="bg-gray-800 text-white px-2 py-1 rounded w-full"
          >
            {logFiles.map((file) => {
              const label = file.startsWith("container:")
                ? `(Container) ${file.replace("container:", "")}`
                : file;
              return (
                <option key={file} value={file} title={label}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        <button
          onClick={handleDownload}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded shrink-0 disabled:opacity-50"
          disabled={!selectedFile}
          title="Download current log"
        >
          Download
        </button>

        <button
          onClick={() => setStreaming((prev) => !prev)}
          className={`px-4 py-1 rounded text-white shrink-0 ${
            streaming ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-600"
          }`}
          disabled={!selectedFile}
        >
          {streaming ? "Stop Live" : "Live Stream"}
        </button>

        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-gray-800 text-white px-2 py-1 rounded border border-gray-600 w-full sm:w-64 md:w-80 shrink-0"
        />
      </div>

      <div className="overflow-auto bg-black p-4 border border-gray-700 rounded flex-1 whitespace-pre-wrap text-sm">
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : logLines.length > 0 ? (
          logLines.map((line, idx) => <div key={idx}>{highlightMatch(line)}</div>)
        ) : (
          <p className="text-gray-400">No content</p>
        )}
      </div>
    </div>
  );
}