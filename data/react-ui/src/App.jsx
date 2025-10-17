import React, { useState } from "react";
import { NetworkMap } from "./components/NetworkMap";
import { HostsTable } from "./components/HostsTable";
import { ScriptsPanel } from "./components/ScriptsPanel";
import { LogsPanel } from "./components/LogsPanel";
import { useNetworkStats } from "./hooks/useNetworkStats";
import BuildTag from "./components/BuildTag";
import ThemeToggle from "./components/ThemeToggle";

const tabs = ["Network Map", "Hosts Table", "Scripts", "Logs"];

function Sidebar({ activeTab, setActiveTab, visible, setVisible }) {
  const stats = useNetworkStats();

  return (
    <>
      {/* Overlay (mobile only) */}
      {visible && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setVisible(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static z-40 top-0 left-0 h-full w-64 bg-gray-900 text-white p-4 flex flex-col transform transition-transform duration-300
        ${visible ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold">Atlas UI</h1>
            <BuildTag />
            <div className="ml-2"><ThemeToggle /></div>
          </div>
          {/* Collapse button (desktop only) */}
          <button
            className="hidden lg:block text-gray-400 hover:text-white"
            onClick={() => setVisible(!visible)}
            title={visible ? "Collapse sidebar" : "Expand sidebar"}
          >
            {visible ? "«" : "»"}
          </button>
          {/* Close (mobile) */}
          <button
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setVisible(false)}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (window.innerWidth < 1024) setVisible(false); // auto-close on mobile
              }}
              className={`w-full text-left p-2 rounded ${
                activeTab === tab ? "bg-gray-700" : "hover:bg-gray-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-auto text-sm pt-6 border-t border-gray-700">
          <h2 className="font-semibold mb-1">Network Stats:</h2>
          <p>Total Hosts: {stats.total}</p>
          <p>
            Docker Hosts: {stats.docker}{" "}
            <span className="text-xs ml-1">
              (<span className="text-green-400">{stats.dockerRunning} </span>,{" "}
              <span className="text-red-400">{stats.dockerStopped} </span>)
            </span>
          </p>
          <p>Normal Hosts: {stats.normal}</p>
          <p>Unique Subnets: {stats.subnets}</p>
          <p>Duplicate IPs: {stats.duplicateIps}</p>
          {stats.updatedAt && (
            <p className="mt-2 text-gray-400 italic">Updated: {stats.updatedAt}</p>
          )}
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Network Map");
  const [selectedNode, setSelectedNode] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <div className="flex h-screen bg-gray-100 relative">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        visible={sidebarVisible}
        setVisible={setSidebarVisible}
      />

      <div className="flex-1 p-4 overflow-hidden">
        {/* Mobile toggle button */}
        <div className="flex items-center justify-between mb-4">
          <button
            className="lg:hidden bg-gray-800 text-white px-3 py-1 rounded shadow"
            onClick={() => setSidebarVisible(true)}
          >
            ☰ Menu
          </button>
        </div>

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
