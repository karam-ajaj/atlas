import React, { useMemo, useRef, useEffect, useState } from "react";
import { NetworkMap } from "./components/NetworkMap";
import { HostsTable } from "./components/HostsTable";
import { ScriptsPanel } from "./components/ScriptsPanel";
import { LogsPanel } from "./components/LogsPanel";
import { useNetworkStats } from "./hooks/useNetworkStats";
import { apiGet, getAuthToken } from "./api";
import BuildTag from "./components/BuildTag";
import MobileHeader from "./components/MobileHeader";
import LoginModal from "./components/LoginModal";
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
  const [loginVisible, setLoginVisible] = useState(false);
  const [hostsShowDuplicates, setHostsShowDuplicates] = useState(false);
  const githubUrl = "https://github.com/karam-ajaj/atlas";

  const [authState, setAuthState] = useState({ checked: false, enabled: false, authenticated: false });

  const openLogin = () => setLoginVisible(true);
  const closeLogin = () => setLoginVisible(false);

  // Auth gate: if server auth is enabled, require login before rendering the app.
  useEffect(() => {
    let aborted = false;

    async function checkAuth() {
      try {
        const enabledJson = await apiGet("/auth/enabled");
        const enabled = !!enabledJson?.enabled;

        if (!enabled) {
          if (!aborted) setAuthState({ checked: true, enabled: false, authenticated: true });
          return;
        }

        let authenticated = false;
        if (getAuthToken()) {
          try {
            const me = await apiGet("/auth/me");
            authenticated = !!me?.authenticated;
          } catch {
            authenticated = false;
          }
        }

        if (!aborted) setAuthState({ checked: true, enabled: true, authenticated });
        if (!aborted && !authenticated) setLoginVisible(true);
      } catch {
        // If auth check fails, fall back to previous behavior (render app).
        if (!aborted) setAuthState({ checked: true, enabled: false, authenticated: true });
      }
    }

    checkAuth();
    return () => {
      aborted = true;
    };
  }, []);

  // Keep UI in sync with token changes (logout, expiry, manual localStorage clear).
  useEffect(() => {
    function onAuthChanged() {
      if (!authState.checked) return;
      if (!authState.enabled) return;

      const token = getAuthToken();
      if (!token) {
        setAuthState((s) => ({ ...s, authenticated: false }));
        setLoginVisible(true);
        return;
      }

      apiGet("/auth/me")
        .then((me) => {
          const ok = !!me?.authenticated;
          setAuthState((s) => ({ ...s, authenticated: ok }));
          if (!ok) setLoginVisible(true);
        })
        .catch(() => {
          setAuthState((s) => ({ ...s, authenticated: false }));
          setLoginVisible(true);
        });
    }

    window.addEventListener("atlas-auth-changed", onAuthChanged);
    return () => window.removeEventListener("atlas-auth-changed", onAuthChanged);
  }, [authState.checked, authState.enabled]);

  // If auth is enabled and we become unauthenticated, reset transient UI state.
  useEffect(() => {
    if (!authState.enabled) return;
    if (!authState.checked) return;
    if (authState.authenticated) return;

    setActiveTab("Network Map");
    setSelectedNode(null);
    setHostsShowDuplicates(false);
    setSidebarVisible(false);
  }, [authState.checked, authState.enabled, authState.authenticated]);

  const mustLogin = authState.checked && authState.enabled && !authState.authenticated;

  // Prevent any data/UI flash before auth check completes.
  // If auth is enabled, we will immediately show the login gate after the check.
  if (!authState.checked) {
    return <div className="h-screen bg-gray-100" />;
  }

  if (mustLogin) {
    return (
      <div className="h-screen bg-gray-100 relative">
        <LoginModal
          open
          force
          onAuthed={() => {
            setAuthState((s) => ({ ...s, authenticated: true }));
            setLoginVisible(false);
          }}
          onClose={() => {
            // forced: do nothing
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 relative">
      {/* Mobile Header - only visible on mobile; pass menu opener */}
      <MobileHeader
        onOpenMenu={() => setSidebarVisible(true)}
        onOpenLogin={openLogin}
        githubUrl={githubUrl}
      />

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
            {/* Left placeholder (kept intentionally empty) */}
            <div />

            {/* Right: desktop-only login button (placeholder for real auth) */}
            <div className="flex items-center">
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden lg:inline-flex bg-transparent text-gray-700 hover:text-gray-900 p-2 rounded-md"
                title="View on GitHub"
                aria-label="View on GitHub"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" role="img" aria-hidden="true">
                  <path d="M12 2c-5.5 0-10 4.5-10 10 0 4.4 2.9 8.2 6.9 9.5.5.1.7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.2-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.4 9.4 0 0 1 5 0c2-1.3 2.8-1 2.8-1 .5 1.4.2 2.5.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.8-4.6 5 .4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5A10 10 0 0 0 22 12c0-5.5-4.5-10-10-10z" />
                </svg>
              </a>
              <button
                className="hidden lg:inline-flex bg-transparent text-gray-700 hover:text-gray-900 p-2 rounded-md"
                title="Login"
                aria-label="Login"
                onClick={openLogin}
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" role="img" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" fill="currentColor" />
                  <path d="M4 20c0-4 3.6-7.3 8-7.3s8 3.3 8 7.3" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              </button>
            </div>
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
      <LoginModal
        open={loginVisible}
        onClose={closeLogin}
        onAuthed={(session) => {
          if (!session) {
            setAuthState((s) => ({ ...s, authenticated: false }));
            setLoginVisible(true);
            return;
          }
          setAuthState((s) => ({ ...s, authenticated: true }));
        }}
      />
    </div>
  );
}
