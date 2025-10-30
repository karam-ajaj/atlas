import React, { useMemo, useRef, useEffect, useState } from "react";
import { NetworkMap } from "./components/NetworkMap";
import { HostsTable } from "./components/HostsTable";
import { ScriptsPanel } from "./components/ScriptsPanel";
import { LogsPanel } from "./components/LogsPanel";
import { useNetworkStats } from "./hooks/useNetworkStats";
import BuildTag from "./components/BuildTag";
import MobileHeader from "./components/MobileHeader";
// Theme toggle removed per request

const tabs = ["Network Map", "Hosts Table", "Scripts", "Logs"];

// Simple inline SVG icons (no external deps)
function TabIcon({ tab, className = "w-6 h-6" }) {
  const common = "fill-current";
  switch (tab) {
    case "Network Map":
      return (
        <svg viewBox="0 0 24 24" className={`${className} ${common}`}> 
          <path d="M6 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm12 12a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM6 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm12-12a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM8.5 7.5l7 9M8.5 16.5l7-9" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        </svg>
      );
    case "Hosts Table":
      return (
        <svg viewBox="0 0 24 24" className={`${className} ${common}`}>
          <path d="M3 5h18v4H3zM3 10.5h18M3 15h18M3 19h18" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        </svg>
      );
    case "Scripts":
      return (
        <svg viewBox="0 0 24 24" className={`${className} ${common}`}>
          <path d="M5 4h10l4 4v12H5z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M9 13l-3 3 3 3M12 19h5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        </svg>
      );
    case "Logs":
      return (
        <svg viewBox="0 0 24 24" className={`${className} ${common}`}>
          <path d="M4 5h16v14H4z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      );
    default:
      return null;
  }
}

function Sidebar({ activeTab, setActiveTab, visible, setVisible, onShowDuplicates }) {
  const stats = useNetworkStats();
  const sidebarRef = useRef(null);

  // Collapse on outside click (desktop)
  useEffect(() => {
    function onDocClick(e) {
      const isDesktop = window.innerWidth >= 1024;
      if (!isDesktop) return; // mobile handled by overlay
      if (!visible) return;
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setVisible(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [visible, setVisible]);

  return (
    <>
      {/* Overlay (mobile only) */}
      {visible && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setVisible(false)}
        ></div>
      )}

      {/* Sidebar container (mobile: slide-over, desktop: collapsible rail) */}
      <div
        className={`z-40 top-0 left-0 bg-gray-900 text-white flex flex-col transition-all duration-300
        fixed h-full w-64 transform ${visible ? "translate-x-0" : "-translate-x-full"} lg:static lg:h-auto lg:transform-none
        ${visible ? "lg:w-64" : "lg:w-16"}`}
        ref={sidebarRef}
        onClick={() => {
          // Expand when clicking the collapsed rail (desktop)
          if (window.innerWidth >= 1024 && !visible) setVisible(true);
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-4 py-3">
          <div className={`flex items-center space-x-2 ${visible ? "lg:flex" : "lg:hidden"}`}>
            <h1 className="text-xl font-bold">Atlas</h1>
            <BuildTag />
          </div>
          {/* Close (mobile) */}
          <button
            className="lg:hidden text-gray-300 hover:text-white"
            onClick={() => setVisible(false)}
          >
            ✕
          </button>
        </div>

        {/* Single nav list with animated icon-to-label transition */}
        <div className="px-2 py-1">
          <div className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (window.innerWidth < 1024) setVisible(false);
                }}
                title={tab}
                className={`w-full flex items-center ${visible ? "justify-start" : "justify-center"} p-2 rounded transition-colors duration-200 ${
                  activeTab === tab ? "bg-gray-700" : "hover:bg-gray-800"
                }`}
              >
                <TabIcon tab={tab} />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${
                    visible ? "opacity-100 ml-3 w-auto" : "opacity-0 ml-0 w-0"
                  }`}
                >
                  {tab}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats (hidden on desktop when collapsed) */}
        <div className={`mt-auto text-sm pt-6 border-t border-gray-700 px-4 ${visible ? "lg:block" : "lg:hidden"}`}>
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
          <p>
            Duplicate IPs: {" "}
            <button
              className="underline text-blue-300 hover:text-blue-200"
              title="Show duplicate IPs in Hosts table"
              onClick={() => onShowDuplicates?.()}
            >
              {stats.duplicateIps}
            </button>
          </p>
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
  // Default: collapsed on desktop, hidden on mobile
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [hostsShowDuplicates, setHostsShowDuplicates] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-gray-100 relative">
      {/* Mobile Header - only visible on mobile */}
      <MobileHeader />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          visible={sidebarVisible}
          setVisible={setSidebarVisible}
          onShowDuplicates={() => {
            setActiveTab("Hosts Table");
            setHostsShowDuplicates(true);
          }}
        />

        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            {/* Mobile open button */}
            <button
              className="lg:hidden bg-gray-800 text-white px-3 py-1 rounded shadow"
              onClick={() => setSidebarVisible(true)}
            >
              ☰ Menu
            </button>
            {/* No desktop button; use the rail toggle inside the sidebar */}
          </div>

          {/* Content area fills remaining height; individual tabs handle their own internal scroll */}
          <div className="w-full h-full flex-1 min-h-0">
            {activeTab === "Network Map" && (
              <NetworkMap onNodeSelect={setSelectedNode} selectedNode={selectedNode} />
            )}
            {activeTab === "Hosts Table" && (
              <HostsTable
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
                showDuplicates={hostsShowDuplicates}
                onClearPreset={() => setHostsShowDuplicates(false)}
              />
            )}
            {activeTab === "Scripts" && <ScriptsPanel />}
            {activeTab === "Logs" && <LogsPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
