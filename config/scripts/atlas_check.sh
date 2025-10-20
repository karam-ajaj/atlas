#!/bin/bash

set -euo pipefail

LOGFILE="/config/logs/boot.log"
mkdir -p /config/logs

log() {
  printf "%s 🔹 %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$1" | tee -a "$LOGFILE"
}

ATLAS_UI_PORT="${ATLAS_UI_PORT:-8888}"
ATLAS_API_PORT="${ATLAS_API_PORT:-8889}"

# Render Nginx config (IMPORTANT: restrict variables so $uri etc. survive)
if [[ -f /config/nginx/default.conf.template ]]; then
  log "Rendering Nginx template (UI:$ATLAS_UI_PORT API:$ATLAS_API_PORT)"
  envsubst '${ATLAS_UI_PORT} ${ATLAS_API_PORT}' < /config/nginx/default.conf.template > /etc/nginx/conf.d/default.conf
else
  log "⚠️ Template /config/nginx/default.conf.template missing. Using existing config."
fi

# Ensure Go binary exists
if [[ ! -x /config/bin/atlas ]]; then
  log "❌ Missing /config/bin/atlas (Go scanner). Scans will fail."
else
  log "✅ Found atlas binary."
fi

# Initialize DB BEFORE starting API to avoid early 500s
if [[ -x /config/bin/atlas ]]; then
  log "📦 Initializing database..."
  if /config/bin/atlas initdb >> /config/logs/scan_audit.log 2>&1; then
    log "✅ Database initialized."
  else
    log "❌ Database init failed (see scan_audit.log)."
  fi
fi

# Start FastAPI (scheduler will be started automatically on FastAPI startup)
log "🚀 Starting FastAPI backend on port $ATLAS_API_PORT..."
export PYTHONPATH=/config
uvicorn scripts.app:app --host 0.0.0.0 --port "$ATLAS_API_PORT" > /config/logs/uvicorn.log 2>&1 &
API_PID=$!

# Note: Scans are now scheduled automatically by the scheduler module
# The scheduler will run scans at configured intervals (see environment variables)
log "📅 Scan scheduler will run scans at configured intervals"
log "   - FASTSCAN_INTERVAL: ${FASTSCAN_INTERVAL:-3600}s (default: 3600s / 1 hour)"
log "   - DOCKERSCAN_INTERVAL: ${DOCKERSCAN_INTERVAL:-3600}s (default: 3600s / 1 hour)"  
log "   - DEEPSCAN_INTERVAL: ${DEEPSCAN_INTERVAL:-7200}s (default: 7200s / 2 hours)"

# Start Nginx in foreground
log "🌐 Starting Nginx server on port $ATLAS_UI_PORT..."
nginx -g "daemon off;"