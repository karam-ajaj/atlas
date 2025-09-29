# Atlas Dependencies

This document lists the software dependencies for each component of the Atlas stack.

## 1. Docker Container / System

These dependencies are installed via the `apk` package manager in the `Dockerfile` and are available system-wide within the container.

-   `alpine:latest`: Base Docker image.
-   `golang:1.22-alpine`: Used as a build stage for the Go binary.
-   `nginx`: Web server and reverse proxy.
-   `iputils-ping`: For network diagnostics.
-   `traceroute`: For network diagnostics.
-   `nmap`: Core tool used for network scanning.
-   `sqlite`: Command-line interface for SQLite.
-   `net-tools`: Basic networking utilities.
-   `curl`: For making HTTP requests from the shell.
-   `jq`: JSON processor for shell scripting.
-   `ca-certificates`: For SSL/TLS connections.
-   `docker`: The Docker CLI, used to communicate with the host's Docker socket.
-   `py3-pip`: Python package installer.
-   `gettext`: Used for environment variable substitution in the NGINX template.

## 2. Go Backend (`atlas` scanner)

Dependencies are managed in `config/atlas_go/go.mod`.

-   **`github.com/mattn/go-sqlite3`**: The driver for interacting with the SQLite database.

## 3. Python Backend (FastAPI)

These packages are installed via `pip` into a virtual environment within the container.

-   **`fastapi`**: The core web framework for building the API.
-   **`uvicorn`**: The ASGI server that runs the FastAPI application.

## 4. React Frontend

Dependencies are managed in `data/react-ui/package.json` and installed using `npm`.

### Production Dependencies (`dependencies`)
-   **`@tanstack/react-table`**: For creating data tables.
-   **`@tanstack/react-virtual`**: For virtualizing large data sets (improves performance).
-   **`date-fns`**: For date formatting.
-   **`react`**: The core React library.
-   **`react-dom`**: Serves as the entry point to the DOM and server renderers for React.
-   **`react-spinners`**: Loading spinner components.
-   **`react-window`**: For rendering large lists efficiently.
-   **`vis-data`**: Data manipulation for Vis Network.
-   **`vis-network`**: For creating dynamic, interactive network visualizations.

### Development Dependencies (`devDependencies`)
-   **`@vitejs/plugin-react`**: Vite plugin for React.
-   **`autoprefixer`**: PostCSS plugin to parse CSS and add vendor prefixes.
-   **`postcss`**: A tool for transforming CSS with JavaScript.
-   **`tailwindcss`**: A utility-first CSS framework.
-   **`vite`**: The frontend build tool.
