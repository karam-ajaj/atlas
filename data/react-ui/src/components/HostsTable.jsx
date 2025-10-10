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
  // Schema for docker_hosts: [id, container_id, ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen, online_status]
  // Schema for hosts: [id, ip, name, os_details, mac_address, open_ports, next_hop, network_name, last_seen, online_status]
  // We normalize both to use the same format, adjusting for docker_hosts having an extra container_id field
  
  if (group === "docker") {
    return {
      id: r[0],
      container_id: r[1] || "",
      ip: r[2] || "",
      name: r[3] || "NoName",
      os: r[4] || "Unknown",
      mac: r[5] || "Unknown",
      ports: r[6] || "no_ports",
      nextHop: r[7] || "Unknown",
      network: r[8] || "docker",
      lastSeen: r[9] || "Invalid",
      online_status: r[10] || "unknown",
      group,
      subnet: subnetOf(r[2] || ""),
    };
  } else {
    return {
      id: r[0],
      ip: r[1] || "",
      name: r[2] || "NoName",
      os: r[3] || "Unknown",
      mac: r[4] || "Unknown",
      ports: r[5] || "no_ports",
      nextHop: r[6] || "Unknown",
      network: r[7] || "",
      lastSeen: r[8] || "Invalid",
      online_status: r[9] || "unknown",
      group,
      subnet: subnetOf(r[1] || ""),
    };
  }
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

// Categorical columns for dropdowns
const dropdownCols = [
  "group",
  "network",
  "online_status",
  "subnet"
];

function FilterDropdown({ values, value, onChange, placeholder = "All", width = "w-32" }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = values.filter(v => v.toLowerCase().includes(search.toLowerCase()));

  function handleSelect(v) {
    onChange(v);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`w-full px-1 py-1 border rounded text-xs bg-white text-left ${width}`}
        onClick={() => setOpen(o => !o)}
        tabIndex={0}
      >
        {value || placeholder}
        <span className="ml-1">&#9662;</span>
      </button>
      {open && (
        <div className={`absolute left-0 top-full z-30 mt-1 bg-white border rounded shadow-md ${width} max-h-48 overflow-auto`}>
          <input
            className="w-full px-2 py-1 border-b text-xs"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div>
            <div
              className={`cursor-pointer px-2 py-1 text-xs ${!value ? "bg-blue-50" : ""}`}
              onClick={() => handleSelect("")}
            >
              All
            </div>
            {filtered.map(v => (
              <div
                key={v}
                className={`cursor-pointer px-2 py-1 text-xs ${v === value ? "bg-blue-100" : ""}`}
                onClick={() => handleSelect(v)}
              >
                {v}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HostsTable() {
  const [raw, setRaw] = useState({ hosts: [], docker: [] });
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState("group");
  const [sortDir, setSortDir] = useState("asc");
  const [mode, setMode] = useState("basic"); // basic | advanced
  const [density, setDensity] = useState("comfortable"); // comfortable | compact
  const [filters, setFilters] = useState({}); // column filters

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
  const basicCols = [
    "name", "ip", "os", "group", "ports"
  ];

  const allRows = useMemo(() => [
    ...raw.hosts.map((r) => normalizeRow(r, "normal")),
    ...raw.docker.map((r) => normalizeRow(r, "docker")),
  ], [raw]);

  // Get unique values for dropdown columns
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
    if (sortKey === "group") {
      const primary = [...filtered].sort((a, b) => {
        const ga = a.group === "normal" ? 0 : 1;
        const gb = b.group === "normal" ? 0 : 1;
        if (ga !== gb) return ga - gb;
        return ipToNum(a.ip) - ipToNum(b.ip);
      });
      return sortDir === "desc" ? primary.reverse() : primary;
    }
    return sortRows(filtered, sortKey, sortDir);
  }, [allRows, q, sortKey, sortDir, filters]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

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
      {/* Toolbar */}
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

      {/* Scroll container */}
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
                    >
                      <div className="flex flex-col gap-1">
                        <span
                          className="cursor-pointer"
                          onClick={() => toggleSort(col)}
                          style={{ userSelect: "none" }}
                        >
                          {colTitles[col]}
                        </span>
                        {dropdownCols.includes(col) ? (
                          <FilterDropdown
                            values={dropdownValues[col]}
                            value={filters[col] ?? ""}
                            onChange={v => setFilters(f => ({ ...f, [col]: v }))}
                            placeholder="All"
                          />
                        ) : (
                          <input
                            className="w-full px-1 py-1 border rounded text-xs mt-1"
                            style={{ minWidth: 0 }}
                            placeholder="Filter"
                            value={filters[col] ?? ""}
                            onChange={e => setFilters(f => ({ ...f, [col]: e.target.value }))}
                          />
                        )}
                      </div>
                    </th>
                  ) : null
                )}
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const key = r.group === "docker" && r.container_id 
                  ? `${r.group}-${r.container_id}-${r.network}` 
                  : `${r.group}-${r.ip}-${r.name}`;
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
                            {/* vertical line, green if online, red if offline */}
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