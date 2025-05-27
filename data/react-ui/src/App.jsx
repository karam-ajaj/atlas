import React, { useState } from "react";
import { NetworkMap } from "./components/NetworkMap";
import { HostsTable } from "./components/HostsTable";
import { LogsPanel } from "./components/LogsPanel";

const tabs = ["Network Map", "Hosts Table", "Logs"];

export default function App() {
  const [activeTab, setActiveTab] = useState("Network Map");
  const [selectedNode, setSelectedNode] = useState(null);

  return (
    <div className="flex h-screen">
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
          <p>Hosts: 128</p>
          <p>Docker: 80</p>
          <p>Subnets: 6</p>
        </div>
      </div>

      <div className="flex-1 bg-gray-100 p-4 overflow-hidden">
        {activeTab === "Network Map" && <NetworkMap onNodeSelect={setSelectedNode} />}
        {activeTab === "Hosts Table" && <HostsTable selectedNode={selectedNode} />}
        {activeTab === "Logs" && <LogsPanel />}
      </div>
    </div>
  );
}
