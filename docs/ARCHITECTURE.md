# Atlas Architecture

This document outlines the high-level architecture of the Atlas project, a containerized network infrastructure visualizer.

## Core Components

The system is composed of five primary components, all running within a single Docker container:

1.  **React Frontend:** The user interface, providing interactive network maps, host tables, and controls to trigger scans.
2.  **NGINX:** A lightweight web server that serves the static React frontend and acts as a reverse proxy for the backend API.
3.  **FastAPI Backend:** A Python-based API that serves data from the database to the frontend and provides endpoints to trigger new scans.
4.  **Go Scanner (`atlas`):** A compiled Go binary containing the core scanning logic. It performs network discovery (fast/deep scans) and Docker introspection.
5.  **SQLite Database:** A file-based database that stores all discovered network information, acting as the single source of truth for the backend.

## System Diagram

The following diagram illustrates how these components interact:

```ascii
+---------------------------------------------------------------------------------+
| Docker Container                                                                |
|                                                                                 |
|  +------------------+      +------------------+      +------------------------+ |
|  |                  |      |                  |      |                        | |
|  |      User        |----->|      NGINX       |----->|      React App         | |
|  | (Web Browser)    |      | (Port: 8888)     |      | (Static Files)         | |
|  |                  |      |                  |      |                        | |
|  +------------------+      +-------+----------+      +------------------------+ |
|                                    |                                            |
|      +-----------------------------+------------------------------+             |
|      | Reverse Proxy (/api)                                       |             |
|      v                                                            |             |
|  +---+--------------+      +------------------+      +------------+-----------+ |
|  |                  |      |                  |      |                        | |
|  |  FastAPI Backend |----->|   Go Scanner     |----->|      SQLite DB         | |
|  | (Python/Uvicorn) |      |  (atlas binary)  |      | (/config/db/atlas.db)  | |
|  |  (Port: 8889)    |      |                  |      |                        | |
|  +------------------+      +------------------+      +------------------------+ |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

### Component Responsibilities

-   **NGINX:**
    -   Listens on the primary UI port (e.g., `8888`).
    -   Serves the built React application files from `/usr/share/nginx/html`.
    -   Forwards all requests starting with `/api/` to the FastAPI backend running on its internal port (e.g., `8889`).

-   **React Frontend:**
    -   Fetches network data from the FastAPI `/api/hosts` endpoint.
    -   Provides buttons that call API endpoints (e.g., `/api/scripts/run/scan-hosts-fast`) to initiate scans.
    -   Renders data into tables and network graphs.

-   **FastAPI Backend:**
    -   Provides HTTP endpoints to query the SQLite database.
    -   Exposes endpoints to execute the Go scanner binary via `subprocess` calls.
    -   Streams scan output back to the client in real-time.

-   **Go Scanner:**
    -   A command-line tool with subcommands (`initdb`, `fastscan`, `deepscan`, `dockerscan`).
    -   Called by the FastAPI backend or the initial entrypoint script.
    -   Performs the actual network scans using tools like `nmap` and interacts with the Docker socket.
    -   Writes all results directly to the SQLite database.

-   **SQLite Database:**
    -   Persists all discovered information about hosts, containers, and networks.
    -   Located at `/config/db/atlas.db` inside the container.
