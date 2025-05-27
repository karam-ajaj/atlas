export function HostsTable() {
  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-2">Hosts Table</h2>
      <input
        type="text"
        className="border p-2 w-full mb-4"
        placeholder="Search by IP, name..."
      />
      <table className="w-full table-auto">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2">IP</th>
            <th className="p-2">Name</th>
            <th className="p-2">OS</th>
            <th className="p-2">Group</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="p-2">192.168.1.10</td>
            <td className="p-2">host-1</td>
            <td className="p-2">Ubuntu</td>
            <td className="p-2">docker</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
