import React, { useEffect, useMemo, useState, useRef } from "react";
import { apiGet } from "../api";

function ipToNum(ip) {
  const m = (ip || "").match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return (
    (parseInt(m[1]) << 24) +
    (parseInt(m[2]) << 16) +
    (parseInt(m[3]) << 8) +
    parseInt(m[4])
  );
}
function subnetOf(ip) {
  const parts = (ip || "").split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}` : "";
}
function fmtLastSeen(v) {
  if (!v || v.toLowerCase() === "invalid" || v.toLowerCase() === "unknown") return "—";
  const s = (v + "Z").replace(" ", "T");
  const d = new Date(s);
  if (isNaN(d.getTime())) return v;
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
function normalizeRow(r, group) {
  return {
    id: r[0],
    ip: r[1] || "",
    name: r[2] || "NoName",
    os: r[3] || "Unknown",
    mac: r[4] || "Unknown",
    ports: r[5] || "no_ports",
    nextHop: r[6] || "Unknown",
    network: r[7] || (group === "docker" ? "docker" : ""),
    lastSeen: r[8] || "Invalid",
    online_status: r[9] || "unknown",
    group,
    subnet: subnetOf(r[1] || ""),
  };
}
function sortRows(rows, key, dir) {
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (key === "ip") return (ipToNum(a.ip) - ipToNum(b.ip)) * sign;
    if (key === "lastSeen") {
      const ad = new Date((a.lastSeen + "Z").replace(" ", "T")).getTime() || 0;
      const bd = new Date((b.lastSeen + "Z").replace(" ", "T")).getTime() || 0;
      return (ad - bd) * sign;
    }
    const av = (a[key] || "").toString().toLowerCase();
    const bv = (b[key] || "").toString().toLowerCase();
    if (av < bv) return -1 * sign;
    if (av > bv) return 1 * sign;
    return (ipToNum(a.ip) - ipToNum(b.ip)) * sign;
  });
}

const dropdownCols = [
  "group",
  "network",
  "online_status",
  "subnet"
];

const colTitles = {
  name: "Name",
  ip: "IP",
  os: "OS",
  mac: "MAC",
  group: "Group",
  ports: "Ports",
  nextHop: "Next hop",
  subnet: "Subnet",
  network: "Network",
  lastSeen: "Last seen",
  online_status: "Online Status"
};

function InlineSearchDropdown({ values, value, onChange, placeholder = "All", onClose, colTitle }) {
  const [search, setSearch] = useState("");
  const ref = useRef();

  const filtered = useMemo(() => {
    if (!search) return values;
    const lower = search.toLowerCase();
    return values.filter(v => v.toLowerCase().includes(lower));
  }, [values, search]);

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  return (
    <div ref={ref} className="relative">
      <input
        autoFocus
        type="text"
        className="w-full px-1 py-1 border rounded text-xs bg-white"
        placeholder={`Search ${colTitle}...`}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="absolute left-0 top-full z-30 mt-1 bg-white border rounded shadow-md w-full max-h-48 overflow-auto">
        <div
          className={`cursor-pointer px-2 py-1 text-xs ${!value ? "bg-blue-50" : ""}`}
          onMouseDown={() => { onChange(""); onClose(); }}
        >
          {`ALL ${colTitle}`}
        </div>
        {filtered.map(v => (
          <div
            key={v}
            className={`cursor-pointer px-2 py-1 text-xs ${v === value ? "bg-blue-100" : ""}`}
            onMouseDown={() => { onChange(v); onClose(); }}
          >
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

function SortToolbar({ sortKey, setSortKey, sortDir, setSortDir, columns, colTitles }) {
  return (
    <div className="flex items-center gap-2 mb-2 ml-2">
      <label className="font-semibold text-gray-700 mr-2">Sort by</label>
      <select
        value={sortKey}
        onChange={e => setSortKey(e.target.value)}
        className="px-2 py-1 rounded border border-gray-400 bg-white text-xs font-semibold"
      >
        {columns.map(col =>
          <option key={col} value={col}>{colTitles[col]}</option>
        )}
      </select>
      <div className="flex gap-1 items-center ml-2">
        <button
          onClick={() => setSortDir("asc")}
          className={`px-2 py-1 rounded border text-xs font-semibold ${sortDir === "asc" ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
          title="Sort ascending"
        >
          <span style={{ display: "inline-block" }}>▲</span> Ascending
        </button>
        <button
          onClick={() => setSortDir("desc")}
          className={`px-2 py-1 rounded border text-xs font-semibold ${sortDir === "desc" ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
          title="Sort descending"
        >
          <span style={{ display: "inline-block" }}>▼</span> Descending
        </button>
      </div>
    </div>
  );
}

function HostsTable() {
  const [raw, setRaw] = useState({ hosts: [], docker: [] });
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState("group");
  const [sortDir, setSortDir] = useState("asc");
  const [mode, setMode] = useState("basic");
  const [density, setDensity] = useState("comfortable");
  const [filters, setFilters] = useState({});
  const [filteringCol, setFilteringCol] = useState(null);

  useEffect(() => {
    let abort = false;
    apiGet("/hosts")
      .then((json) => {
        if (abort) return;
        const hostsRows = Array.isArray(json?.[0]) ? json[0] : [];
        const dockerRows = Array.isArray(json?.[1]) ? json[1] : [];
        setRaw({ hosts: hostsRows, docker: dockerRows });
      })
      .catch(() => {
        if (!abort) setRaw({ hosts: [], docker: [] });
      });
    return () => { abort = true; };
  }, []);

  const columns = [
    "name",
    "ip",
    "os",
    "mac",
    "group",
    "ports",
    "nextHop",
    "subnet",
    "network",
    "lastSeen",
    "online_status"
  ];
  const basicCols = [
    "name", "ip", "os", "group", "ports"
  ];

  const allRows = useMemo(() => [
    ...raw.hosts.map((r) => normalizeRow(r, "normal")),
    ...raw.docker.map((r) => normalizeRow(r, "docker")),
  ], [raw]);

  const dropdownValues = useMemo(() => {
    const values = {};
    dropdownCols.forEach(col => {
      values[col] = Array.from(
        new Set(
          allRows
            .map(r => r[col])
            .filter(v => v && v !== "unknown" && v !== "—")
        )
      ).sort();
    });
    return values;
  }, [allRows]);

  const columnValues = useMemo(() => {
    const values = {};
    columns.forEach(col => {
      if (dropdownCols.includes(col)) {
        values[col] = dropdownValues[col];
      } else {
        values[col] = Array.from(new Set(allRows.map(r => (r[col] ?? "").toString()).filter(v => v))).sort();
      }
    });
    return values;
  }, [columns, allRows, dropdownValues]);

  const rows = useMemo(() => {
    let filtered = allRows;
    if (q) {
      const needle = q.toLowerCase();
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(needle) ||
        r.ip.toLowerCase().includes(needle) ||
        r.os.toLowerCase().includes(needle) ||
        r.mac.toLowerCase().includes(needle) ||
        r.ports.toLowerCase().includes(needle) ||
        r.network.toLowerCase().includes(needle) ||
        r.subnet.toLowerCase().includes(needle) ||
        r.group.toLowerCase().includes(needle) ||
        (r.online_status ?? "").toLowerCase().includes(needle)
      );
    }
    Object.entries(filters).forEach(([col, value]) => {
      if (value && value !== "__all__") {
        filtered = filtered.filter(r =>
          dropdownCols.includes(col)
            ? r[col] === value
            : (r[col] ?? "").toString().toLowerCase().includes(value.toLowerCase())
        );
      }
    });
    // Now sort by any column, not just group
    return sortRows(filtered, sortKey, sortDir);
  }, [allRows, q, sortKey, sortDir, filters]);

  function exportCSV() {
    const header = columns;
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        header
          .map((col) => `"${String(r[col] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hosts.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const thBase =
    "px-3 text-[11px] leading-4 font-semibold uppercase tracking-wide text-gray-600 bg-gray-100 border-b-2 border-gray-200 sticky top-0 z-20 whitespace-nowrap";
  const tdBase = "px-3 border-b border-gray-200 align-middle";
  const rowH = density === "compact" ? "h-9 text-[13px]" : "h-11 text-sm";
  const thH = density === "compact" ? "h-9" : "h-10";
  const isAdvanced = mode === "advanced";

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search hosts..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-80 md:w-96 px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded border overflow-hidden">
            <button
              onClick={() => setMode("basic")}
              className={`px-3 py-2 text-sm ${mode === "basic" ? "bg-gray-200" : "bg-white"}`}
              title="Show key columns only"
            >
              Basic
            </button>
            <button
              onClick={() => setMode("advanced")}
              className={`px-3 py-2 text-sm ${mode === "advanced" ? "bg-gray-200" : "bg-white"}`}
              title="Show all columns"
            >
              Advanced
            </button>
          </div>
          <div className="inline-flex rounded border overflow-hidden">
            <button
              onClick={() => setDensity("comfortable")}
              className={`px-3 py-2 text-sm ${density === "comfortable" ? "bg-gray-200" : "bg-white"}`}
              title="Comfortable spacing"
            >
              Cozy
            </button>
            <button
              onClick={() => setDensity("compact")}
              className={`px-3 py-2 text-sm ${density === "compact" ? "bg-gray-200" : "bg-white"}`}
              title="Compact rows"
            >
              Dense
            </button>
          </div>
          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Export
          </button>
        </div>
      </div>
      {/* Sort toolbar above table */}
      <SortToolbar
        sortKey={sortKey}
        setSortKey={setSortKey}
        sortDir={sortDir}
        setSortDir={setSortDir}
        columns={columns}
        colTitles={colTitles}
      />
      <div className="relative flex-1 overflow-auto rounded border border-gray-200">
        <div className="min-w-full overflow-x-auto">
          <table className="w-full min-w-[1280px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col style={{ width: "32%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead className="bg-gray-100">
              <tr>
                {columns.map(col =>
                  (isAdvanced || basicCols.includes(col)) ? (
                    <th
                      key={col}
                      className={`${thBase} ${thH} border-r border-gray-200 last:border-r-0`}
                      style={{ position: "relative", minWidth: "100px", background: "#f7fafc" }}
                    >
                      <div
                        className="w-full"
                        style={{ minWidth: "100px", minHeight: "32px" }}
                        onClick={() => {
                          if (filteringCol !== col) setFilteringCol(col);
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Filter by ${colTitles[col]}`}
                      >
                        {filteringCol === col ? (
                          <InlineSearchDropdown
                            values={columnValues[col]}
                            value={filters[col] ?? ""}
                            onChange={v => setFilters(f => ({ ...f, [col]: v }))}
                            placeholder={`Search ${colTitles[col]}...`}
                            onClose={() => setFilteringCol(null)}
                            colTitle={colTitles[col]}
                          />
                        ) : (
                          <div className="flex items-center gap-1 w-full h-full cursor-pointer hover:bg-blue-50 rounded px-1 py-1"
                            title={`Click to filter by ${colTitles[col]}`}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"
                              className="inline mr-1 opacity-70"
                              style={{ marginRight: "4px" }}>
                              <circle cx="9" cy="9" r="7" stroke="#333" strokeWidth="2" />
                              <line x1="15" y1="15" x2="19" y2="19" stroke="#333" strokeWidth="2" />
                            </svg>
                            <span className="font-semibold">{colTitles[col]}</span>
                          </div>
                        )}
                      </div>
                    </th>
                  ) : null
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const key = `${r.group}-${r.ip}-${r.name}`;
                return (
                  <tr key={key} className="select-text">
                    {columns.map(col => {
                      if (!isAdvanced && !basicCols.includes(col)) return null;
                      let content;
                      if (col === "os") {
                        content = (
                          <span className={`block truncate ${(!r.os || /^unknown$/i.test(r.os)) ? "text-gray-400" : ""}`} title={r.os || "—"}>
                            {r.os && !/^unknown$/i.test(r.os) ? r.os : "—"}
                          </span>
                        );
                      } else if (col === "mac") {
                        content = (
                          <span className={`block whitespace-nowrap ${(!r.mac || /^unknown$/i.test(r.mac)) ? "text-gray-400" : ""}`} title={r.mac || "—"}>
                            {r.mac && !/^unknown$/i.test(r.mac) ? r.mac : "—"}
                          </span>
                        );
                      } else if (col === "group") {
                        content = (
                          <span className="capitalize">{r.group}</span>
                        );
                      } else if (col === "ports") {
                        content = (
                          <div title={r.ports} className="min-w-0">
                            <div
                              className="block"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {r.ports}
                            </div>
                          </div>
                        );
                      } else if (col === "nextHop") {
                        content = (
                          <span className={`block truncate ${(!r.nextHop || /^unknown$/i.test(r.nextHop) || r.nextHop === "unavailable") ? "text-gray-400" : ""}`} title={r.nextHop || "—"}>
                            {r.nextHop && !/^unknown$/i.test(r.nextHop) && r.nextHop !== "unavailable" ? r.nextHop : "—"}
                          </span>
                        );
                      } else if (col === "subnet") {
                        content = r.subnet || <span className="text-gray-400">—</span>;
                      } else if (col === "network") {
                        content = (
                          <span className={`block truncate ${(!r.network || /^unknown$/i.test(r.network)) ? "text-gray-400" : ""}`} title={r.network || "—"}>
                            {r.network && !/^unknown$/i.test(r.network) ? r.network : "—"}
                          </span>
                        );
                      } else if (col === "lastSeen") {
                        content = fmtLastSeen(r.lastSeen);
                      } else if (col === "online_status") {
                        content = (
                          <span className={`block truncate ${(!r.online_status || /^unknown$/i.test(r.online_status)) ? "text-gray-400" : ""}`}>
                            {r.online_status && !/^unknown$/i.test(r.online_status) ? r.online_status : "—"}
                          </span>
                        );
                      } else if (col === "name") {
                        const statusColor =
                          r.online_status && r.online_status.toLowerCase() === "online"
                            ? "bg-emerald-500"
                            : "bg-red-500";
                        content = (
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`inline-block h-6 w-1 rounded ${statusColor}`}
                              style={{ minWidth: "4px", marginRight: "8px" }}
                            />
                            <span className="min-w-0 block truncate" title={r.name}>
                              {r.name}
                            </span>
                          </div>
                        );
                      } else if (col === "ip") {
                        content = (
                          <span className="whitespace-nowrap font-mono" title={r.ip}>
                            {r.ip}
                          </span>
                        );
                      } else {
                        content = r[col] ?? "—";
                      }
                      return (
                        <td
                          key={col}
                          className={`${tdBase} ${rowH} border-r border-gray-200 last:border-r-0`}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={columns.length}>
                    No data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default HostsTable;
export { HostsTable };