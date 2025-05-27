import React, { useEffect, useMemo, useState, useRef } from "react";
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
    fetch("https://atlas-api.vnerd.nl/hosts")
      .then((res) => res.json())
      .then(([normal, docker]) => {
        const flatten = (arr, group) =>
          arr.map(([id, ip, name, os, _, ports]) => ({
            id: `${group[0]}-${id}`,
            ip,
            name,
            os,
            group,
            ports,
          }));
        setData([...flatten(normal, "normal"), ...flatten(docker, "docker")]);
      });
  }, []);

  const columns = useMemo(
    () => [
      { accessorKey: "ip", header: "IP" },
      { accessorKey: "name", header: "Name" },
      { accessorKey: "os", header: "OS" },
      { accessorKey: "group", header: "Group" },
      { accessorKey: "ports", header: "Ports" },
    ],
    []
  );

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
      ["IP", "Name", "OS", "Group", "Ports"],
      ...visibleRows.map(row => [row.ip, row.name, row.os, row.group, row.ports])
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
      <div className="flex items-center justify-between mb-2">
        <input
          type="text"
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search..."
          className="p-2 border w-full mr-2"
        />
        <button
          onClick={exportVisibleToCSV}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Export
        </button>
      </div>
      <div
        ref={tableContainerRef}
        className="h-[70vh] overflow-auto border rounded"
      >
        <table className="w-full text-sm text-left border-collapse">
          <thead className="sticky top-0 bg-gray-100 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2 border-b cursor-pointer"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
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
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isSelected = row.original.ip === selectedNode?.ip;
              return (
                <tr
                  key={row.id}
                  className={`border-t hover:bg-gray-50 ${isSelected ? 'bg-yellow-100' : ''}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                    width: "100%",
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-1">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
