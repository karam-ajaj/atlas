# Stage 1: Build the Go binary
FROM golang:1.22 AS builder

WORKDIR /app
COPY config/atlas_go /app

RUN go build -o atlas .

# Stage 2: Final runtime image
FROM python:3.11-slim

# Install only what you need for runtime
RUN apt update && apt install -y \
    nginx iputils-ping traceroute nmap sqlite3 net-tools curl jq gettext-base \
    && pip install fastapi uvicorn \
    && apt install -y docker.io \
    && apt clean && rm -rf /var/lib/apt/lists/*

# Remove default Nginx config
RUN rm -f /etc/nginx/conf.d/default.conf /etc/nginx/sites-enabled/default

# Copy Nginx config template and static HTML
COPY config/nginx/default.conf.template /config/nginx/default.conf.template
COPY data/html/ /usr/share/nginx/html/

# Copy scripts, logs, Go binary, FastAPI backend
# COPY config /config/
COPY config/scripts /config/scripts
COPY --from=builder /app/atlas /config/bin/atlas

# Make all shell scripts executable
RUN chmod +x /config/scripts/*.sh

# Entrypoint: initializes DB, runs scans, launches FastAPI and Nginx
CMD ["/config/scripts/atlas_check.sh"]

# Default UI port (override via ATLAS_UI_PORT) and API port
EXPOSE 8888 8889
