export function SelectedNodePanel({ node, subnet, route }) {
  if (!node && !subnet && !route) return null;

  return (
    <div className="absolute top-4 right-4 bg-white border shadow rounded p-4 text-sm z-10 w-72">
      <h3 className="font-semibold mb-2">Subnet Info</h3>

      {/* Subnet node */}
      {subnet && (
        <div>
          <div><strong>Name:</strong> {subnet.label}</div>
          <div><strong>Prefix:</strong> {subnet.subnet}</div>
        </div>
      )}

      {/* Docker Network Node */}
      {node?.group === "network" && (
        <div>
          <div><strong>Name:</strong> {node.name}</div>
          <div><strong>Prefix:</strong> {node.subnet}</div>
        </div>
      )}

      {/* Normal or Docker Host */}
      {node && (node.group === "normal" || node.group === "docker") && (
        <div className="space-y-1">
          <div><strong>Name:</strong> {node.name}</div>
          <div><strong>IP:</strong> {node.ip}</div>
          <div><strong>OS:</strong> {node.os}</div>
          <div><strong>MAC:</strong> {node.mac}</div>
          <div><strong>Ports:</strong> {node.ports}</div>
          <div><strong>Subnet:</strong> {node.subnet}</div>
          <div><strong>Network:</strong> {node.network_name}</div>
          <div><strong>Last Seen:</strong> {node.last_seen}</div>
        </div>
      )}

      {/* Inter-subnet route */}
      {route && (
        <div>
          <div><strong>Route:</strong></div>
          <div>{route.from} → {route.to}</div>
        </div>
      )}
    </div>
  );
}
