import React from "react";

export function SelectedNodePanel({ node, route, subnet }) {
  if (!node && !route && !subnet) return null;

  return (
    <div className="absolute top-4 right-4 w-80 bg-white border rounded shadow p-4">
      {/* <h3 className="text-md font-semibold mb-2">
        {node ? "Node Info" : "Route Info"}
      </h3> */}
      {node && (
        <div className="space-y-1 text-sm">
          <h3 className="text-md font-semibold mb-2">Node Info</h3>
          <p><strong>Name:</strong> {node.name}</p>
          <p><strong>IP:</strong> {node.ip}</p>
          <p><strong>OS:</strong> {node.os}</p>
          <p><strong>Group:</strong> {node.group}</p>
          <p><strong>Subnet:</strong> {node.subnet}</p>
          <p><strong>Ports:</strong> {node.ports}</p>
        </div>
      )}
      {route && (
        <div className="space-y-1 text-sm">
          <h3 className="text-md font-semibold mb-2">Route Info</h3>
          <p><strong>From:</strong> {route.from}</p>
          <p><strong>To:</strong> {route.to}</p>
        </div>
      )}
      {subnet && (
        <div className="space-y-1 text-sm">
          <h3 className="text-md font-semibold mb-2">Subnet Info</h3>
          <p><strong>Name:</strong> {subnet.label}</p>
          <p><strong>Prefix:</strong> {subnet.subnet}</p>
        </div>
      )}
    </div>
  );
}
