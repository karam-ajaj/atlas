# Stage 1: Build Go binary
FROM golang:1.25.3 AS builder
WORKDIR /app
COPY config/atlas_go /app
# If you have go.mod in config/atlas_go, this is enough; otherwise add module init
RUN if [ ! -f go.mod ]; then go mod init atlas || true; fi
RUN go build -o atlas .

# Stage 2: Runtime
FROM python:3.11-slim

RUN apt-get update && \
    apt-get install -y \
        nginx iputils-ping traceroute nmap sqlite3 net-tools curl jq ca-certificates nbtscan docker.io && \
    apt-get upgrade -y && \
    pip install --no-cache-dir fastapi==0.121.0 uvicorn==0.38.0 protobuf==4.25.8 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Remove default Nginx config
RUN rm -f /etc/nginx/conf.d/default.conf /etc/nginx/sites-enabled/default || true

# Copy template & static UI content
COPY config/nginx/default.conf.template /config/nginx/default.conf.template
COPY data/html/ /usr/share/nginx/html/

# Copy scripts and binary
COPY config/scripts /config/scripts
COPY --from=builder /app/atlas /config/bin/atlas

# Make all shell scripts executable
RUN chmod +x /config/scripts/*.sh

# Set default ports (can be overridden at runtime)
ENV ATLAS_UI_PORT=8888
ENV ATLAS_API_PORT=8889

# Set default scan intervals in seconds (can be overridden at runtime)
ENV FASTSCAN_INTERVAL=3600
ENV DOCKERSCAN_INTERVAL=3600
ENV DEEPSCAN_INTERVAL=7200

# Entrypoint: initializes DB, runs scans, launches FastAPI and Nginx
EXPOSE 8888 8889
CMD ["/config/scripts/atlas_check.sh"]