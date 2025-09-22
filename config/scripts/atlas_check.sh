#!/bin/bash

LOGFILE="/config/logs/boot.log"
mkdir -p /config/logs

log() {
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "$TIMESTAMP 🔹 $1" | tee -a "$LOGFILE"
}

# Start FastAPI in the background
log "🚀 Starting FastAPI backend..."
export PYTHONPATH=/config
uvicorn scripts.app:app --host 0.0.0.0 --port 8889 > /config/logs/uvicorn.log 2>&1 &

# Start Nginx in the foreground — this keeps the container alive
ATLAS_UI_PORT=${ATLAS_UI_PORT:-8888}
log "🌐 Rendering Nginx config for UI port ${ATLAS_UI_PORT}..."
envsubst '${ATLAS_UI_PORT}' < /config/nginx/default.conf.template > /etc/nginx/conf.d/default.conf
log "🌐 Starting Nginx server on port ${ATLAS_UI_PORT}..."
nginx -g "daemon off;" &

NGINX_PID=$!

# Run scans in background
(
  log "📦 Initializing database..."
  /config/bin/atlas initdb && log "✅ Database initialized."

  log "🚀 Running fast scan..."
  /config/bin/atlas fastscan && log "✅ Fast scan complete."

  log "🐳 Running Docker scan..."
  /config/bin/atlas dockerscan && log "✅ Docker scan complete."

  log "🕵️ Running deep host scan..."
  /config/bin/atlas deepscan && log "✅ Deep scan complete."
) &

wait "$NGINX_PID"
