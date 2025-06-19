import React from "react";

export function StatusDot({ status }) {
  const color =
    status === "online"
      ? "bg-green-500"
      : status === "offline"
      ? "bg-red-500"
      : "bg-gray-400";

  return (
    <span
      className={`inline-block w-3 h-3 rounded-full mr-2 ${color}`}
      title={status || "unknown"}
    ></span>
  );
}
