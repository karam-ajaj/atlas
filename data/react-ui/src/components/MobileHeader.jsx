import React from "react";

export default function MobileHeader({ onOpenMenu, onOpenLogin }) {
  return (
    <div className="lg:hidden bg-gray-900 text-white px-3 py-2 flex items-center shadow-md">
      {/* Left: logo + menu */}
      <div className="flex items-center space-x-2">
        {/* Logo placeholder - replace with SVG when available */}
        <span className="text-2xl" role="img" aria-label="Atlas logo">🌐</span>
  {/* App name removed from top bar on request — only logo + hamburger remain */}

        {/* Menu (hamburger) button */}
        <button
          className="text-gray-300 hover:text-white p-2 rounded-md hover:bg-gray-800 transition-colors"
          aria-label="Open menu"
          title="Menu"
          onClick={() => onOpenMenu?.()}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
      </div>

      {/* Middle: search (empty for now) */}
      <div className="flex-1 px-3">
        <input
          aria-label="Search"
          placeholder=""
          className="w-full bg-gray-800 text-white placeholder-gray-400 rounded-full px-3 py-1 focus:outline-none"
          value={""}
          readOnly
        />
      </div>

      {/* Right: login/user icon */}
      <div className="flex items-center">
        <button
          className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors"
          title="User Login (Coming Soon)"
          aria-label="User Login"
          onClick={() => onOpenLogin?.()}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" role="img" aria-hidden="true">
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path d="M4 20c0-4 3.6-7.3 8-7.3s8 3.3 8 7.3" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </button>
      </div>
    </div>
  );
}
