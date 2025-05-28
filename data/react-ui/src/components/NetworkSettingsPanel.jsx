
// components/NetworkSettingsPanel.jsx

export function NetworkSettingsPanel({ layoutStyle, setLayoutStyle }) {
  return (
    <div className="flex space-x-4 mb-4">
      <label className="flex items-center space-x-2">
        <span className="text-sm">Layout:</span>
        <select
          value={layoutStyle}
          onChange={(e) => setLayoutStyle(e.target.value)}
          className="border p-1 rounded"
        >
          <option value="default">Default</option>
          <option value="hierarchical">Hierarchical</option>
          <option value="circular">Circular</option>
        </select>
      </label>
    </div>
  );
}
