import React, { useEffect, useState } from "react";
import { apiGet, apiPost, getAuthToken, setAuthToken } from "../api";

export default function LoginModal({ open, onClose, force = false, onAuthed }) {
  if (!open) return null;

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(null);
  const [me, setMe] = useState(null);

  useEffect(() => {
    let aborted = false;
    setError("");

    apiGet("/auth/enabled")
      .then((json) => {
        if (aborted) return;
        setEnabled(!!json?.enabled);
        if (json?.user) setUsername(json.user);
      })
      .catch(() => {
        if (!aborted) setEnabled(false);
      });

    const token = getAuthToken();
    if (token) {
      apiGet("/auth/me")
        .then((json) => {
          if (!aborted) setMe(json);
        })
        .catch(() => {
          if (!aborted) setMe({ authenticated: false, user: null });
        });
    } else {
      setMe({ authenticated: false, user: null });
    }

    return () => {
      aborted = true;
    };
  }, [open]);

  async function doLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const json = await apiPost("/auth/login", { json: { username, password } });
      if (!json?.token) throw new Error("No token returned");
      setAuthToken(json.token);
      setPassword("");
      setMe({ authenticated: true, user: json.user || username });
      onAuthed?.({ token: json.token, user: json.user || username, expiresAt: json.expires_at });
      onClose();
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function doLogout() {
    setError("");

    // Optimistic local logout (instant UI update).
    const token = getAuthToken();
    setAuthToken("");
    setPassword("");
    setMe({ authenticated: false, user: null });
    onAuthed?.(null);

    // Best-effort server-side session cleanup (don't block UI).
    setLoading(true);
    Promise.resolve(
      apiPost("/auth/logout", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    )
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={force ? undefined : onClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-lg w-11/12 max-w-md p-6 shadow-lg z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Login</h2>
          <button
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300"
            onClick={force ? undefined : onClose}
            aria-label="Close login modal"
            disabled={force}
          >
            ✕
          </button>
        </div>

        {enabled === false && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Authentication is not enabled on the server.
            <div className="mt-2 text-xs text-gray-500">Set <code>ATLAS_ADMIN_PASSWORD</code> to enable login.</div>
          </div>
        )}

        {enabled !== false && me?.authenticated && (
          <div className="text-sm text-gray-700 dark:text-gray-200">
            Logged in as <span className="font-semibold">{me.user}</span>.
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                onClick={onClose}
                disabled={loading}
              >
                Close
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                onClick={doLogout}
                disabled={loading}
              >
                Logout
              </button>
            </div>
          </div>
        )}

        {enabled !== false && !me?.authenticated && (
          <form onSubmit={doLogin}>
            <label className="block mb-2 text-sm text-gray-700 dark:text-gray-300">Username</label>
            <input
              className="w-full mb-3 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />

            <label className="block mb-2 text-sm text-gray-700 dark:text-gray-300">Password</label>
            <input
              type="password"
              className="w-full mb-2 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
