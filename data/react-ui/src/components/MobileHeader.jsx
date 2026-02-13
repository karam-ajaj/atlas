import React from "react";

export default function MobileHeader({ onOpenMenu, onOpenLogin, githubUrl }) {
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

      {/* Right: repo + login/user icon */}
      <div className="flex items-center">
        <a
          className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors"
          title="View on GitHub"
          aria-label="View on GitHub"
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" role="img" aria-hidden="true">
            <path d="M12 2c-5.5 0-10 4.5-10 10 0 4.4 2.9 8.2 6.9 9.5.5.1.7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.2-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.4 9.4 0 0 1 5 0c2-1.3 2.8-1 2.8-1 .5 1.4.2 2.5.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.8-4.6 5 .4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5A10 10 0 0 0 22 12c0-5.5-4.5-10-10-10z" />
          </svg>
        </a>
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
