export function LogsPanel() {
  return (
    <div className="bg-black text-green-400 font-mono p-4 rounded h-full overflow-y-auto">
      <p>[INFO] Atlas daemon started</p>
      <p>[INFO] New subnet detected: 10.0.0.0/24</p>
      <p>[WARN] Duplicate MAC on 172.17.0.5</p>
    </div>
  );
}
