import React, { useEffect, useMemo, useState, useRef } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

export function HostsTable({ selectedNode }) {
  const [data, setData] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    fetch("/api/hosts")
      .then((res) => res.json())
      .then(([normal, docker]) => {
        const flatten = (arr, group) =>
          arr.map(([id, ip, name, os, mac, ports, nexthop, network_name, last_seen]) => ({
            id: `${group[0]}-${id}`,
            ip,
            name,
            os,
            mac,
            group,
            ports,
            nexthop,
            network_name,
            subnet: ip.split(".").slice(0, 3).join("."),
            last_seen,
          }));
        setData([...flatten(normal, "normal"), ...flatten(docker, "docker")]);
      });
  }, []);

  const columns = useMemo(() => [
  { accessorKey: "name", header: "Name", meta: { width: "w-64" } },
  { accessorKey: "ip", header: "IP", meta: { width: "w-36" } },
  { accessorKey: "os", header: "OS", meta: { width: "w-24" } },
  { accessorKey: "mac", header: "MAC", meta: { width: "w-48" } },
  { accessorKey: "group", header: "Group", meta: { width: "w-24" } },
  { accessorKey: "ports", header: "Ports", meta: { width: "w-96" } },
  { accessorKey: "nexthop", header: "Next Hop", meta: { width: "w-36" } },
  { accessorKey: "subnet", header: "Subnet", meta: { width: "w-32" } },
  { accessorKey: "network_name", header: "Network", meta: { width: "w-48" } },
  {
  accessorKey: "last_seen",
  header: "Last Seen",
  meta: { width: "w-48" },
  cell: ({ getValue }) => {
    const raw = getValue();
    if (!raw) return "Unknown";
    return formatDistanceToNow(parseISO(raw), { addSuffix: true });
  },
}
], []);


  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) =>
      String(row.getValue(columnId)).toLowerCase().includes(filterValue.toLowerCase()),
  });

  const tableContainerRef = useRef(null);
  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  useEffect(() => {
    if (!selectedNode || !tableContainerRef.current) return;
    const rowIndex = data.findIndex((row) => row.ip === selectedNode.ip);
    if (rowIndex >= 0) {
      const offset = rowVirtualizer.getVirtualItems().find(v => v.index === rowIndex)?.start;
      if (offset !== undefined) {
        tableContainerRef.current.scrollTop = offset;
      }
    }
  }, [selectedNode, data, rowVirtualizer]);

  const exportVisibleToCSV = () => {
    const visibleRows = rowVirtualizer.getVirtualItems().map(v => rows[v.index].original);
    const csv = [
      ["Name", "IP", "OS", "Group", "Ports", "Next Hop", "Subnet", "Network"],
      ...visibleRows.map(row => [
        row.name, row.ip, row.os, row.group, row.ports, row.nexthop, row.subnet, row.network_name
      ])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "visible-hosts.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-2">Hosts Table</h2>

      <div className="flex items-center justify-between mb-4 space-x-2">
        <input
          type="text"
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search hosts..."
          className="flex-1 p-2 border border-gray-300 rounded-md shadow-sm"
        />
        <button
          onClick={exportVisibleToCSV}
          className="px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition"
        >
          Export
        </button>
      </div>

      <div
        ref={tableContainerRef}
        className="h-[70vh] overflow-auto border rounded-lg shadow-sm overflow-x-auto"
      >
        <table className="w-full text-sm text-left border-collapse min-w-[900px]">
          <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm text-gray-700 text-xs uppercase tracking-wider">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
  key={header.id}
  className={`px-4 py-2 border-b font-semibold text-sm bg-gray-100 cursor-pointer select-none ${
    header.column.columnDef.meta?.width || ""
  }`}
  onClick={header.column.getToggleSortingHandler()}
>
  {flexRender(header.column.columnDef.header, header.getContext())}
  {{
    asc: " ▲",
    desc: " ▼",
  }[header.column.getIsSorted()] ?? null}
</th>

                ))}
              </tr>
            ))}
          </thead>
          <tbody
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-4 text-gray-500">
                  No matching hosts found.
                </td>
              </tr>
            ) : (
              rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                const isSelected = row.original.ip === selectedNode?.ip;
                return (
                  <tr
                    key={row.id}
                    className={`border-b ${
                      isSelected
                        ? "bg-yellow-100"
                        : virtualRow.index % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50"
                    } hover:bg-blue-50 transition-all duration-150`}
                    style={{
                      position: "absolute",
                      top: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      width: "100%",
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
  key={cell.id}
  title={cell.getValue()}
  className={`px-4 py-1 truncate ${
    cell.column.columnDef.meta?.width || ""
  } whitespace-nowrap`}
>
  {flexRender(cell.column.columnDef.cell, cell.getContext())}
</td>

                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
