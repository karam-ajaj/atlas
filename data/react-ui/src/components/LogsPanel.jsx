import { useEffect, useState, useRef } from "react";

export function LogsPanel() {
  const [logFiles, setLogFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [logLines, setLogLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const eventSourceRef = useRef(null);
  const seenLinesRef = useRef(new Set());

  useEffect(() => {
    fetch("/api/logs/list")
      .then((res) => res.json())
      .then((files) => {
        setLogFiles(files);
        if (files.length > 0) setSelectedFile(files[0]);
      });
  }, []);

  useEffect(() => {
    if (!selectedFile) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    seenLinesRef.current = new Set();
    setLogLines([]);
    setLoading(true);

    if (streaming) {
      const es = new EventSource(`/api/logs/${selectedFile}/stream`);
      es.onmessage = (event) => {
        const line = event.data.trim();
        if (!seenLinesRef.current.has(line)) {
          seenLinesRef.current.add(line);
          setLogLines((prev) => [...prev.slice(-500), line]);
        }
      };
      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
      };
      eventSourceRef.current = es;
      setLoading(false);
    } else {
      fetch(`/api/logs/${selectedFile}`)
        .then((res) => res.json())
        .then((data) => {
          const lines = data.content.split("\n");
          lines.forEach(line => seenLinesRef.current.add(line));
          setLogLines(lines.slice(-500));
        })
        .finally(() => setLoading(false));
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [selectedFile, streaming]);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `/api/logs/${selectedFile}/download`;
    link.download = selectedFile;
    link.click();
  };

  const highlightMatch = (line) => {
    if (!searchTerm) return line;
    const parts = line.split(new RegExp(`(${searchTerm})`, "gi"));
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
      <div className="flex items-center space-x-4">
        <label className="text-white">Select Log:</label>
        <select
          value={selectedFile}
          onChange={(e) => setSelectedFile(e.target.value)}
          className="bg-gray-800 text-white px-2 py-1 rounded"
        >
          {logFiles.map((file) => (
            <option key={file} value={file}>
              {file.startsWith("container:") ? `(Container) ${file.replace("container:", "")}` : file}
            </option>
          ))}
        </select>

        <button
          onClick={handleDownload}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded"
        >
          Download
        </button>

        <button
          onClick={() => setStreaming((prev) => !prev)}
          className={`px-4 py-1 rounded ${streaming ? "bg-red-600" : "bg-gray-700"} text-white`}
        >
          {streaming ? "Stop Live" : "Live Stream"}
        </button>

        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-gray-800 text-white px-2 py-1 rounded border border-gray-600"
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
