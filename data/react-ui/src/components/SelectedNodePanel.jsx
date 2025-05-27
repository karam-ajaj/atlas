export function SelectedNodePanel({ node }) {
  if (!node) return null;

  return (
    <div className="absolute right-4 top-4 w-64 bg-white shadow-lg rounded border p-4 z-50">
      <h3 className="text-lg font-semibold mb-2">Node Info</h3>
      {Object.entries(node).map(([key, value]) => (
        <div key={key} className="text-sm">
          <span className="font-semibold">{key}:</span> {value}
        </div>
      ))}
    </div>
  );
}
