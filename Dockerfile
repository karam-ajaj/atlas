# Stage 1: Build Go binary
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy module files and download dependencies first to leverage Docker cache
COPY config/atlas_go/go.mod config/atlas_go/go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY config/atlas_go/ ./

# Build the binary
ENV CGO_CFLAGS="-D_LARGEFILE64_SOURCE"
RUN go build -o atlas .

# Stage 2: Runtime
FROM alpine:3.22.1

RUN apk add --no-cache nginx iputils-ping traceroute nmap \
    sqlite net-tools curl jq ca-certificates docker \
    py3-pip gettext && python3 -m venv /opt/venv

# Copy scripts and binary
COPY config/scripts /config/scripts
COPY --from=builder /app/atlas /config/bin/atlas

# Install python packages
ENV PATH="/opt/venv/bin:$PATH"
# hadolint ignore=SC1091
RUN source /opt/venv/bin/activate \ 
    && pip install --upgrade pip \
    && pip install --no-cache-dir fastapi uvicorn \
    && mkdir -p /etc/nginx/http.d || true \
    && chmod +x /config/scripts/*.sh \
    && sed -i 's/\r$//' /config/scripts/atlas_check.sh

# Copy template & static UI content
COPY config/nginx/default.conf.template /config/nginx/default.conf.template
COPY data/html/ /usr/share/nginx/html/

# Set default ports (can be overridden at runtime)
ENV ATLAS_UI_PORT=8888
ENV ATLAS_API_PORT=8889

# Entrypoint: initializes DB, runs scans, launches FastAPI and Nginx
EXPOSE 8888 8889
CMD ["/config/scripts/atlas_check.sh"]
