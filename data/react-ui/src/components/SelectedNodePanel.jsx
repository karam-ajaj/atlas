export function SelectedNodePanel({ node }) {
  if (!node) return null;

  return (
    <div className="absolute right-4 top-4 w-64 bg-white shadow-lg rounded border p-4 z-50">
      <h3 className="text-lg font-semibold mb-2">Node Info</h3>
      <div className="space-y-2 text-sm">
        <div><strong>Name:</strong> {node.name}</div>
        <div><strong>IP:</strong> {node.ip}</div>
        <div><strong>OS:</strong> {node.os}</div>
        <div><strong>Group:</strong> {node.group}</div>
        <div><strong>Subnet:</strong> {node.subnet}</div>
        <div><strong>Ports:</strong> {node.ports}</div>
      </div>
    </div>
  );
}
