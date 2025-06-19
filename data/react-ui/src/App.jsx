import React, { useState } from "react";
import { NetworkMap } from "./components/NetworkMap";
import { HostsTable } from "./components/HostsTable";
import { ScriptsPanel } from "./components/ScriptsPanel";
import { LogsPanel } from "./components/LogsPanel";
import { useNetworkStats } from "./hooks/useNetworkStats";

const tabs = ["Network Map", "Hosts Table", "Scripts", "Logs"];

function Sidebar({ activeTab, setActiveTab }) {
  const stats = useNetworkStats();

  return (
    <div className="w-64 bg-gray-900 text-white p-4 flex flex-col">
      <h1 className="text-xl font-bold mb-6">Atlas UI</h1>
      <div className="space-y-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`w-full text-left p-2 rounded ${
              activeTab === tab ? "bg-gray-700" : "hover:bg-gray-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="mt-auto text-sm pt-6 border-t border-gray-700">
        <h2 className="font-semibold mb-1">Network Stats:</h2>
        <p>Total Hosts: {stats.total}</p>
        <p>Docker Hosts: {stats.docker}</p>
        <p>Normal Hosts: {stats.normal}</p>
        <p>Unique Subnets: {stats.subnets}</p>
        <p>Duplicate IPs: {stats.duplicateIps}</p>
        {stats.updatedAt && (
          <p className="mt-2 text-gray-400 italic">Updated: {stats.updatedAt}</p>
      )}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Network Map");
  const [selectedNode, setSelectedNode] = useState(null);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 p-4 overflow-hidden">
        {activeTab === "Network Map" && (
          <NetworkMap onNodeSelect={setSelectedNode} selectedNode={selectedNode} />
        )}
        {activeTab === "Hosts Table" && (
          <HostsTable selectedNode={selectedNode} onSelectNode={setSelectedNode} />
        )}
        {activeTab === "Scripts" && <ScriptsPanel />}
        {activeTab === "Logs" && <LogsPanel />}
      </div>
    </div>
  );
}
