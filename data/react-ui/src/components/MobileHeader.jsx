import React from "react";
import BuildTag from "./BuildTag";

export default function MobileHeader() {
  return (
    <div className="lg:hidden bg-gray-900 text-white px-4 py-3 flex items-center justify-between shadow-md">
      {/* Left side: Logo and name */}
      <div className="flex items-center space-x-2">
        <span className="text-2xl">🌐</span>
        <h1 className="text-xl font-bold">Atlas</h1>
        <BuildTag />
      </div>

      {/* Right side: User login icon placeholder */}
      <div className="flex items-center">
        <button
          className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors"
          title="User Login (Coming Soon)"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6 fill-current"
            aria-label="User icon"
          >
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path
              d="M4 20c0-4 3.6-7.3 8-7.3s8 3.3 8 7.3"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
