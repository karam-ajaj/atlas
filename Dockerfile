# Stage 1: Build Go binary
FROM golang:1.22-alpine AS go-builder
WORKDIR /app
# Copy module files and download dependencies first to leverage Docker cache
COPY config/atlas_go/go.mod config/atlas_go/go.sum ./
RUN go mod download
# Copy the rest of the source code
COPY config/atlas_go/ ./
# Build the binary
ENV CGO_CFLAGS="-D_LARGEFILE64_SOURCE"
RUN apk add --no-cache build-base \
    && CGO_ENABLED=1 go build -o atlas .

# Stage 2: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY data/react-ui/package.json data/react-ui/package-lock.json ./
# Use npm ci for cleaner, reproducible installs
RUN npm install -g npm && npm ci
COPY data/react-ui/ ./
RUN npm run build

# Stage 3: Final Runtime Image
FROM alpine:3.22.1

RUN apk add --no-cache nginx iputils-ping traceroute nmap \
    sqlite net-tools curl jq ca-certificates docker \
    py3-pip gettext && python3 -m venv /opt/venv

# Copy items from previous stages and local context
COPY config/scripts /config/scripts
COPY config/nginx/default.conf.template /config/nginx/default.conf.template
COPY --from=go-builder /app/atlas /config/bin/atlas
COPY --from=frontend-builder /app/dist /usr/share/nginx/html/

# Install python packages and set permissions
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip \
    && pip install --no-cache-dir fastapi uvicorn \
    && mkdir -p /etc/nginx/http.d || true \
    && chmod +x /config/scripts/*.sh

# Expose ports and define command
EXPOSE 8888
CMD ["/config/scripts/atlas_check.sh"]
