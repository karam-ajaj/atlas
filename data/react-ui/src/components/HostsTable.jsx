import React, { useEffect, useMemo, useState } from "react";
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

function HostsTable() {
  const [raw, setRaw] = useState({ hosts: [], docker: [] });
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState("group");
  const [sortDir, setSortDir] = useState("asc");
  const [mode, setMode] = useState("basic"); // basic | advanced
  const [density, setDensity] = useState("comfortable"); // comfortable | compact

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

  const rows = useMemo(() => {
    const merged = [
      ...raw.hosts.map((r) => normalizeRow(r, "normal")),
      ...raw.docker.map((r) => normalizeRow(r, "docker")),
    ];

    const filtered = q
      ? merged.filter((r) => {
          const needle = q.toLowerCase();
          return (
            r.name.toLowerCase().includes(needle) ||
            r.ip.toLowerCase().includes(needle) ||
            r.os.toLowerCase().includes(needle) ||
            r.mac.toLowerCase().includes(needle) ||
            r.ports.toLowerCase().includes(needle) ||
            r.network.toLowerCase().includes(needle) ||
            r.subnet.toLowerCase().includes(needle) ||
            r.group.toLowerCase().includes(needle)
          );
        })
      : merged;

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
  }, [raw, q, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function exportCSV() {
    const header = [
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
    ];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.name,
            r.ip,
            r.os,
            r.mac,
            r.group,
            r.ports,
            r.nextHop,
            r.subnet,
            r.network,
            r.lastSeen,
        ]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
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

  // UI helpers
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
            </colgroup>

            <thead className="bg-gray-100">
              <tr>
                <th className={`${thBase} ${thH} border-r border-gray-200 last:border-r-0`} onClick={() => toggleSort("name")}>Name</th>
                <th className={`${thBase} ${thH} border-r border-gray-200 last:border-r-0`} onClick={() => toggleSort("ip")}>IP</th>
                <th className={`${thBase} ${thH} border-r border-gray-200 last:border-r-0`} onClick={() => toggleSort("os")}>OS</th>
                <th className={`${thBase} ${thH} ${isAdvanced ? "" : "hidden"} border-r border-gray-200 last:border-r-0`} onClick={() => toggleSort("mac")}>MAC</th>
                <th className={`${thBase} ${thH} border-r border-gray-200 last:border-r-0`} onClick={() => toggleSort("group")}>Group</th>
                <th className={`${thBase} ${thH} border-r border-gray-200 last:border-r-0`} onClick={() => toggleSort("ports")}>Ports</th>
                <th className={`${thBase} ${thH} ${isAdvanced ? "" : "hidden"} border-r border-gray-200 last:border-r-0`} onClick={() => toggleSort("nextHop")}>Next hop</th>
                <th className={`${thBase} ${thH} ${isAdvanced ? "" : "hidden"} border-r border-gray-200 last:border-r-0`} onClick={() => toggleSort("subnet")}>Subnet</th>
                <th className={`${thBase} ${thH} ${isAdvanced ? "" : "hidden"} border-r border-gray-200 last:border-r-0`} onClick={() => toggleSort("network")}>Network</th>
                <th className={`${thBase} ${thH} ${isAdvanced ? "" : "hidden"} border-r border-gray-200 last:border-r-0`} onClick={() => toggleSort("lastSeen")}>Last seen</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const key = `${r.group}-${r.ip}-${r.name}`;
                return (
                  <tr key={key} className="select-text">
                    <td className={`${tdBase} ${rowH} border-r border-gray-200 last:border-r-0`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-block h-2 w-2 rounded-full ${r.group === "docker" ? "bg-emerald-500" : "bg-gray-400"}`} />
                        <span className="min-w-0 block truncate" title={r.name}>
                          {r.name}
                        </span>
                      </div>
                    </td>
                    <td className={`${tdBase} ${rowH} border-r border-gray-200 last:border-r-0 whitespace-nowrap font-mono`} title={r.ip}>
                      {r.ip}
                    </td>
                    <td className={`${tdBase} ${rowH} border-r border-gray-200 last:border-r-0`}>
                      <span className={`block truncate ${(!r.os || /^unknown$/i.test(r.os)) ? "text-gray-400" : ""}`} title={r.os || "—"}>
                        {r.os && !/^unknown$/i.test(r.os) ? r.os : "—"}
                      </span>
                    </td>
                    <td className={`${tdBase} ${rowH} ${isAdvanced ? "" : "hidden"} border-r border-gray-200 last:border-r-0`}>
                      <span className={`block whitespace-nowrap ${(!r.mac || /^unknown$/i.test(r.mac)) ? "text-gray-400" : ""}`} title={r.mac || "—"}>
                        {r.mac && !/^unknown$/i.test(r.mac) ? r.mac : "—"}
                      </span>
                    </td>
                    <td className={`${tdBase} ${rowH} border-r border-gray-200 last:border-r-0 capitalize`}>
                      {r.group}
                    </td>
                    <td className={`${tdBase} ${rowH} border-r border-gray-200 last:border-r-0`}>
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
                    </td>
                    <td className={`${tdBase} ${rowH} ${isAdvanced ? "" : "hidden"} border-r border-gray-200 last:border-r-0`}>
                      <span className={`block truncate ${(!r.nextHop || /^unknown$/i.test(r.nextHop) || r.nextHop === "unavailable") ? "text-gray-400" : ""}`} title={r.nextHop || "—"}>
                        {r.nextHop && !/^unknown$/i.test(r.nextHop) && r.nextHop !== "unavailable" ? r.nextHop : "—"}
                      </span>
                    </td>
                    <td className={`${tdBase} ${rowH} ${isAdvanced ? "" : "hidden"} border-r border-gray-200 last:border-r-0`} title={r.subnet}>
                      {r.subnet || <span className="text-gray-400">—</span>}
                    </td>
                    <td className={`${tdBase} ${rowH} ${isAdvanced ? "" : "hidden"} border-r border-gray-200 last:border-r-0`}>
                      <span className={`block truncate ${(!r.network || /^unknown$/i.test(r.network)) ? "text-gray-400" : ""}`} title={r.network || "—"}>
                        {r.network && !/^unknown$/i.test(r.network) ? r.network : "—"}
                      </span>
                    </td>
                    <td className={`${tdBase} ${rowH} ${isAdvanced ? "" : "hidden"} border-r border-gray-200 last:border-r-0`} title={r.lastSeen}>
                      {fmtLastSeen(r.lastSeen)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={10}>
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