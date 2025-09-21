# Stage 1: Build the Go binary
FROM --platform=$BUILDPLATFORM golang:1.22 AS builder

ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETOS
ARG TARGETARCH

WORKDIR /app
COPY config/atlas_go /app

# Install cross-compilation tools for CGO
RUN apt-get update && apt-get install -y gcc-aarch64-linux-gnu gcc-x86-64-linux-gnu ca-certificates git && \
    update-ca-certificates

# Download dependencies first with GOPROXY settings and git config
ENV GOPROXY=direct
ENV GOSUMDB=off
RUN git config --global http.sslverify false
RUN go mod download

# Set appropriate CC for cross-compilation and build
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      CC=aarch64-linux-gnu-gcc CGO_ENABLED=1 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o atlas .; \
    else \
      CGO_ENABLED=1 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o atlas .; \
    fi

# Stage 2: Final runtime image
FROM python:3.11-slim

# Install only what you need for runtime
RUN apt update && apt install -y \
    nginx iputils-ping traceroute nmap sqlite3 net-tools curl jq \
    && pip install fastapi uvicorn \
    && apt install -y docker.io \
    && apt clean && rm -rf /var/lib/apt/lists/*

# Remove default Nginx config
RUN rm -f /etc/nginx/conf.d/default.conf /etc/nginx/sites-enabled/default

# Copy Nginx config and static HTML
COPY config/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY data/html/ /usr/share/nginx/html/

# Copy scripts, logs, Go binary, FastAPI backend
# COPY config /config/
COPY config/scripts /config/scripts
COPY --from=builder /app/atlas /config/bin/atlas

# Make all shell scripts executable
RUN chmod +x /config/scripts/*.sh

# Entrypoint: initializes DB, runs scans, launches FastAPI and Nginx
CMD ["/config/scripts/atlas_check.sh"]

EXPOSE 8888 8889