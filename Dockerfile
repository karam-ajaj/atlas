# Stage 1: Build the Go binary
FROM --platform=$BUILDPLATFORM golang:1.22 AS builder

ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETOS
ARG TARGETARCH

WORKDIR /app
COPY config/atlas_go /app

# Install cross-compilation tools for CGO
RUN apt-get update && apt-get install -y gcc-aarch64-linux-gnu ca-certificates git

# Configure git and go for SSL issues in CI
RUN git config --global http.sslverify false

# Download dependencies first with GOPROXY settings
ENV GOPROXY=direct
ENV GOSUMDB=off
ENV GIT_SSL_NO_VERIFY=true
RUN go mod download || true

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
    nginx iputils-ping traceroute nmap sqlite3 net-tools curl jq docker.io \
    && pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org fastapi uvicorn \
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