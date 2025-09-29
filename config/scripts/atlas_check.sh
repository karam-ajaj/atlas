#!/usr/bin/env sh

set -euo pipefail

LOGFILE="/config/logs/boot.log"
mkdir -p /config/logs

log() {
  printf "%s 🔹 %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$1" | tee -a "$LOGFILE"
}

ATLAS_UI_PORT="${ATLAS_UI_PORT:-8888}"
ATLAS_API_PORT="${ATLAS_API_PORT:-8889}"

# Render Nginx config (IMPORTANT: restrict variables so $uri etc. survive)
if [ -f /config/nginx/default.conf.template ]; then
  log "Rendering Nginx template (UI:$ATLAS_UI_PORT API:$ATLAS_API_PORT)"
  envsubst '${ATLAS_UI_PORT} ${ATLAS_API_PORT}' < /config/nginx/default.conf.template > /etc/nginx/http.d/default.conf
else
  log "⚠️ Template /config/nginx/default.conf.template missing. Using existing config."
fi

# Ensure Go binary exists
if [ ! -x /config/bin/atlas ]; then
  log "❌ Missing /config/bin/atlas (Go scanner). Scans will fail."
else
  log "✅ Found atlas binary."
fi

# Initialize DB BEFORE starting API to avoid early 500s
if [ -x /config/bin/atlas ]; then
  log "📦 Initializing database..."
  if /config/bin/atlas initdb >> /config/logs/scan_audit.log 2>&1; then
    log "✅ Database initialized."
  else
    log "❌ Database init failed (see scan_audit.log)."
  fi
fi

# Start FastAPI
log "🚀 Starting FastAPI backend on port $ATLAS_API_PORT..."
export PYTHONPATH=/config
uvicorn scripts.app:app --host 0.0.0.0 --port "$ATLAS_API_PORT" > /config/logs/uvicorn.log 2>&1 &
API_PID=$!

# Kick off scans (non-blocking)
if [ -x /config/bin/atlas ]; then
  (
    log "⚡ Running fast scan..."
    /config/bin/atlas fastscan >> /config/logs/scan_audit.log 2>&1 && log "✅ Fast scan complete."

    log "🐳 Running Docker scan..."
    /config/bin/atlas dockerscan >> /config/logs/scan_audit.log 2>&1 && log "✅ Docker scan complete."

    log "🔍 Running deep host scan..."
    /config/bin/atlas deepscan >> /config/logs/scan_audit.log 2>&1 && log "✅ Deep scan complete."
  ) &
else
  log "⏭️ Skipping scans (atlas binary missing)."
fi

# Start Nginx in foreground
log "🌐 Starting Nginx server on port $ATLAS_UI_PORT..."
nginx -g "daemon off;"
