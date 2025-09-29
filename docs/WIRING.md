# Atlas Wiring & Workflows

This document describes the key operational workflows and the "wiring" between the components of the Atlas system.

## 1. Container Startup Workflow

The primary workflow is initiated by the `atlas_check.sh` script, which is the `CMD` in the `Dockerfile`. This script orchestrates the initial setup and scanning process.

```ascii
  [Container Start]
         |
         v
+--------------------+
| atlas_check.sh     |
+--------------------+
         |
         | 1. Initialize Database
         v
+--------------------+
| ./atlas initdb     | (Go binary creates schema in SQLite)
+--------------------+
         |
         | 2. Run Fast Scan
         v
+--------------------+
| ./atlas fastscan   | (Go binary scans local network, saves to DB)
+--------------------+
         |
         | 3. Run Docker Scan
         v
+--------------------+
| ./atlas dockerscan | (Go binary inspects Docker, saves to DB)
+--------------------+
         |
         | 4. Start API & Web Server
         v
+--------------------+
|  - Start NGINX     |
|  - Start Uvicorn   | (FastAPI backend)
+--------------------+
         |
         v
   [System Ready]
```

## 2. UI Data Request Flow

This workflow shows how the React frontend fetches and displays network data.

```ascii
+-------------+      +----------------+      +-------------------+      +-----------------+
| User visits |----->|   React App    |----->| NGINX (/api/hosts)|----->| FastAPI Backend |
| dashboard   |      | (useEffect)    |      | (Reverse Proxy)   |      | (GET /hosts)    |
+-------------+      +-------+--------+      +-------------------+      +--------+--------+
                               |                                                 |
                               |                                                 v
                               |                                          +--------+--------+
                               |                                          |   SQLite DB     |
                               |                                          | (SELECT * ...)  |
                               |                                          +--------+--------+
                               |                                                 |
                               |                                                 v
                               +-------------------------------------------------+ 
                               | (Receives JSON data)
                               v
                       +-------+--------+
                       | Render Network |
                       | Map & Tables   |
                       +----------------+
```

## 3. Manual Scan Trigger Flow

This workflow shows how a user can initiate a new scan from the UI.

```ascii
+-------------+      +-------------+      +--------------------------------+      +-------------------+
| User clicks |----->|  React App  |----->| NGINX (/api/scripts/run/...)   |----->| FastAPI Backend   |
| 'Scan' btn  |      | (apiPost)   |      | (Reverse Proxy)                |      | (POST /scripts/run)
+-------------+      +-------------+      +--------------------------------+      +--------+----------+
                                                                                           |
                                                                                           | 1. Execute Command
                                                                                           v
                                                                                 +---------+---------+
                                                                                 |  Go Scanner       |
                                                                                 | (./atlas fastscan)| 
                                                                                 +---------+---------+
                                                                                           |
                                                                                           | 2. Write to DB
                                                                                           v
                                                                                 +---------+---------+
                                                                                 |    SQLite DB      |
                                                                                 +-------------------+
```

## 4. Deployment Workflow (`deploy.sh`)

The `deploy.sh` script automates the process of building and publishing a new version of the Atlas Docker image.

```ascii
  [Developer runs deploy.sh]
           |
           v
+--------------------------+
| Prompt for Version Tag   |
| (e.g., v3.4)             |
+--------------------------+
           |
           v
+--------------------------+
| Build React UI           |
| (npm run build)          |
+--------------------------+
           |
           v
+--------------------------+
| Copy UI files to         |
| /data/html               |
+--------------------------+
           |
           v
+--------------------------+
| Write build-info.json    |
+--------------------------+
           |
           v
+--------------------------+
| Build Docker Image       |
| (docker build)           |
+--------------------------+
           |
           v
+--------------------------+
| Push to Docker Hub       |
| (docker push)            |
+--------------------------+
           |
           v
+--------------------------+
| Redeploy Container       |
| (docker run)             |
+--------------------------+
           |
           v
      [Deployment Complete]
```
