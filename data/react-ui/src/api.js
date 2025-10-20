// Central API helper for Atlas React UI
// Priority / resolution order:
// 1. Runtime override: window.ATLAS_API_BASE (set via inline <script> if desired)
// 2. VITE_API_BASE (full absolute or relative; must include /api if you want it)
// 3. Constructed absolute base from protocol + host + port (+ /api)
// 4. Relative fallback: same-origin /api
//
// To force absolute port usage even if mismatched, set VITE_API_FORCE_ABSOLUTE=1
// To explicitly request relative mode, set VITE_API_PORT=SAME_ORIGIN or AUTO (or leave empty)
//
// Example build overrides:
//   VITE_API_BASE=https://atlas.example.com/api
//   VITE_API_PORT=8885
//   VITE_API_FORCE_ABSOLUTE=1

const runtimeOverride = (typeof window !== "undefined" && window.ATLAS_API_BASE)
  ? window.ATLAS_API_BASE.trim()
  : "";

const explicitBase = import.meta.env.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE.trim()
  : "";

const forceAbsolute = import.meta.env.VITE_API_FORCE_ABSOLUTE === "1";

const rawProto = (import.meta.env.VITE_API_PROTOCOL ||
  window.location.protocol.replace(":", "")).replace(/:$/, "");
const rawHost = import.meta.env.VITE_API_HOST || window.location.hostname;
const rawPort = import.meta.env.VITE_API_PORT; // may be undefined

function buildConstructedAbsolute() {
  // If user explicitly says SAME_ORIGIN or AUTO or leaves blank, skip constructing
  if (!rawPort || /^(SAME_ORIGIN|AUTO)$/i.test(rawPort)) return "";
  return `${rawProto}://${rawHost}${rawPort ? ":" + rawPort : ""}/api`;
}

function decideBase() {
  if (runtimeOverride) return sanitize(runtimeOverride);
  if (explicitBase) return sanitize(explicitBase);

  const constructed = buildConstructedAbsolute();

  // If we didn't construct (relative intention)
  if (!constructed) {
    return `${window.location.origin}/api`;
  }

  // If forcing absolute, use it
  if (forceAbsolute) return sanitize(constructed);

  // If constructed port differs from current UI port, and we assume Nginx proxying:
  // fall back to relative (prevents breakage when API port changed without rebuild).
  const uiPort = window.location.port;
  const constructedPortMatch = constructed.match(/:(\d+)\//);
  const constructedPort = constructedPortMatch ? constructedPortMatch[1] : "";

  if (constructedPort && uiPort && constructedPort !== uiPort) {
    // Use relative same-origin + /api
    return `${window.location.origin}/api`;
  }

  return sanitize(constructed);
}

function sanitize(base) {
  // Remove trailing slash (except keep '/api' as path root)
  if (base.endsWith("/")) return base.slice(0, -1);
  return base;
}

export const API_BASE_URL = decideBase();

// ---- Generic helpers ----

function buildUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : "/" + path}`;
}

async function apiRequest(method, path, { json, headers, ...rest } = {}) {
  const url = buildUrl(path);
  const init = {
    method,
    ...rest,
    headers: {
      Accept: "application/json",
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    body: json ? JSON.stringify(json) : rest.body,
  };

  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new Error(`Network error for ${url}: ${e.message}`);
  }

  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch {}
    throw new Error(
      `Request failed ${res.status} ${res.statusText} @ ${url} :: ${text.slice(
        0,
        400
      )}`
    );
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export function apiGet(path, options = {}) {
  return apiRequest("GET", path, options);
}

export function apiPost(path, options = {}) {
  return apiRequest("POST", path, options);
}

// Streaming (SSE) URL builder
export function sseUrl(path) {
  return buildUrl(path);
}

// Domain-specific helpers
export const AtlasAPI = {
  getHosts: () => apiGet("/hosts"),
  getExternal: () => apiGet("/external"),
  listLogs: () => apiGet("/logs/list"),
  getLog: (filename) => apiGet(`/logs/${encodeURIComponent(filename)}`),
  lastScanStatus: () => apiGet("/scripts/last-scan-status"),
  health: () => apiGet("/health"),
  getScanInterval: () => apiGet("/config/scan-interval"),
  setScanInterval: (minutes) => apiPost("/config/scan-interval", { json: { interval_minutes: minutes } }),
};

// Composite health (API + optional UI healthz)
export async function fullHealthCheck() {
  const out = {
    api: { ok: false, error: null },
    ui: { ok: false, error: null },
  };
  try {
    const h = await AtlasAPI.health();
    out.api.ok = h?.status === "ok";
  } catch (e) {
    out.api.error = e.message;
  }
  try {
    const r = await fetch("/healthz", { cache: "no-store" });
    const t = await r.text();
    out.ui.ok = r.ok && t.trim().toUpperCase().includes("OK");
  } catch (e) {
    out.ui.error = e.message;
  }
  return out;
}

// Debug aid in dev mode
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.debug("[atlas] API_BASE_URL =", API_BASE_URL);
  if (runtimeOverride) {
    // eslint-disable-next-line no-console
    console.debug("[atlas] runtime override used");
  }
}