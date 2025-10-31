import React from "react";

export default function LoginModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-lg w-11/12 max-w-md p-6 shadow-lg z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Login</h2>
          <button
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300"
            onClick={onClose}
            aria-label="Close login modal"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            // TODO: hook into real auth
            // eslint-disable-next-line no-alert
            alert("Submit login (stub) — implement auth flow");
            onClose();
          }}
        >
          <label className="block mb-2 text-sm text-gray-700 dark:text-gray-300">Username</label>
          <input className="w-full mb-3 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />

          <label className="block mb-2 text-sm text-gray-700 dark:text-gray-300">Password</label>
          <input type="password" className="w-full mb-4 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />

          <div className="flex justify-end space-x-2">
            <button type="button" className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
