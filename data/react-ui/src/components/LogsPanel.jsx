import { useEffect, useState, useRef, useMemo } from "react";
import { apiGet, sseUrl, API_BASE_URL } from "../api";

// Custom searchable dropdown for log files
function LogFileDropdown({ files, value, onChange }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Filter files by search
  const filteredFiles = useMemo(() => {
    if (!search) return files;
    const lower = search.toLowerCase();
    return files.filter(f => f.toLowerCase().includes(lower));
  }, [files, search]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  // Show label for selected file (same logic as before)
  const label = value
    ? value.startsWith("container:")
      ? `(Container) ${value.replace("container:", "")}`
      : value
    : "";

  return (
    <div className="relative min-w-[220px] max-w-[50%]" ref={ref}>
      <input
        className="bg-gray-800 text-white px-2 py-1 rounded w-full border border-gray-600"
        placeholder="Select Log..."
        value={open ? search : label}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        // onClick={() => setOpen(o => !o)}
        readOnly={!open}
      />
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 bg-gray-900 border border-gray-700 rounded shadow-md w-full max-h-60 overflow-auto">
          {filteredFiles.length === 0 &&
            <div className="px-2 py-2 text-sm text-gray-400">No matching logs</div>}
          {filteredFiles.map(file => {
            const fileLabel = file.startsWith("container:")
              ? `(Container) ${file.replace("container:", "")}`
              : file;
            return (
              <div
                key={file}
                className={`cursor-pointer px-2 py-2 text-sm hover:bg-gray-700 ${
                  file === value ? "bg-blue-700 text-white" : ""
                }`}
                onClick={() => {
                  onChange(file);
                  setOpen(false);
                  setSearch("");
                }}
              >
                {fileLabel}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LogsPanel() {
  const [logFiles, setLogFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [logLines, setLogLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [lineSearch, setLineSearch] = useState("");
  const eventSourceRef = useRef(null);
  const seenLinesRef = useRef(new Set());

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

  useEffect(() => {
    if (!selectedFile) return;
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
    link.href = `${API_BASE_URL}/logs/${enc}/download`;
    link.download = selectedFile;
    link.click();
  };

  const highlightMatch = (line) => {
    if (!lineSearch) return line;
    const escaped = lineSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = line.split(new RegExp(`(${escaped})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === lineSearch.toLowerCase() ? (
        <span key={i} className="bg-yellow-300 text-black px-1 rounded">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const filteredLogLines = useMemo(() => {
    if (!lineSearch) return logLines;
    const lowerSearch = lineSearch.toLowerCase();
    return logLines.filter(l => l.toLowerCase().includes(lowerSearch));
  }, [logLines, lineSearch]);

  return (
    <div className="p-4 bg-gray-900 text-green-300 font-mono rounded shadow h-full flex flex-col space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-white shrink-0">Select Log:</label>
        <LogFileDropdown
          files={logFiles}
          value={selectedFile}
          onChange={setSelectedFile}
        />
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
          placeholder="Search in log..."
          value={lineSearch}
          onChange={(e) => setLineSearch(e.target.value)}
          className="bg-gray-800 text-white px-2 py-1 rounded border border-gray-600 w-full sm:w-64 md:w-80 shrink-0"
        />
      </div>
      <div className="overflow-auto bg-black p-4 border border-gray-700 rounded flex-1 whitespace-pre-wrap text-sm">
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : filteredLogLines.length > 0 ? (
          filteredLogLines.map((line, idx) => <div key={idx}>{highlightMatch(line)}</div>)
        ) : (
          <p className="text-gray-400">No content</p>
        )}
      </div>
    </div>
  );
}