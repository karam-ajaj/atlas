#!/bin/bash

# Initialize database
/config/bin/atlas initdb

# Run fast + docker scan
/config/bin/atlas fastscan
/config/bin/atlas dockerscan

# Launch FastAPI backend
export PYTHONPATH=/config
uvicorn scripts.app:app --host 0.0.0.0 --port 8889 > /config/logs/uvicorn.log 2>&1 &

# Launch Nginx
nginx -g "daemon off;"
