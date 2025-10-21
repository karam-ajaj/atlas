# copilot / AI agent instructions — atlas

Keep this short and actionable. Prefer small, focused changes and reference the exact files shown below.

1) Big picture
- Atlas is a single-container app that combines a Go CLI scanner, a FastAPI backend, Nginx, and a React static UI.
- Main Go CLI: `config/atlas_go/main.go` — commands: `initdb`, `fastscan`, `deepscan`, `dockerscan`.
- Frontend: `data/react-ui/` (Vite + React). Build with `npm install && npm run build`, then copy the output into `data/html/` (Dockerfile does this in CI/deploy).
- Entrypoint & runtime layout: container expects runtime configuration under `/config` (binary at `/config/bin/atlas`, DB at `/config/db/atlas.db`, logs at `/config/logs`). See `Dockerfile` and `config/scripts/atlas_check.sh` for startup.

# copilot / AI agent instructions — atlas

Keep this short and actionable. Prefer small, focused changes and reference the exact files shown below.

1) Big picture
- Atlas is a single-container app that combines a Go CLI scanner, a FastAPI backend, Nginx, and a React static UI.
- Main Go CLI: `config/atlas_go/main.go` — commands: `initdb`, `fastscan`, `deepscan`, `dockerscan`.
- Frontend: `data/react-ui/` (Vite + React). Build with `npm install && npm run build`, then copy the output into `data/html/` (Dockerfile does this in CI/deploy).
- Entrypoint & runtime layout: container expects runtime configuration under `/config` (binary at `/config/bin/atlas`, DB at `/config/db/atlas.db`, logs at `/config/logs`). See `Dockerfile` and `config/scripts/atlas_check.sh` for startup.

2) Where to change code
- Backend scanner logic: `config/atlas_go/internal/scan/*.go` (notably `fastscan.go`, `deep_scan.go`, `docker_scan.go`).
- DB helpers: `config/atlas_go/internal/db/` and SQLite usage is pervasive; queries use `ON CONFLICT(ip, interface_name)` semantics — keep key shapes consistent.
- FastAPI: `scripts/app.py` (API surface used by the UI; proxy config in `config/nginx/default.conf.template`).
- UI: `data/react-ui/src/*` and components under `data/react-ui/src/components/`.

3) Project-specific conventions and patterns
- Interface-aware host model: hosts are keyed by (ip, interface_name). When updating or inserting hosts, use the same conflict/unique keys to avoid duplicate rows. See `deep_scan.go` and `fastscan.go` SQL statements.
- Scans run per-network-interface. Use `utils.GetAllInterfaces()` (internal utilities) to enumerate interfaces and loop each subnet separately — previous bug (issue 27) was about scanning only one interface; PRs 61 and 62 fixed it. If modifying scan logic, ensure the function still iterates all returned interfaces.
- External tools are required at runtime: `nmap`, `nbtscan`, `docker` CLI, `curl`, `hostname`, etc. Code calls these via `exec.Command(...)` and parses their stdout. Add unit tests around parsing helpers when possible.
- Long-running commands write logs under `/config/logs` (e.g., `nmap_tcp_<ip>.log`, `deep_scan_progress.log`) — use these when debugging.

4) Dev & debug workflows (examples)
- Build the Go binary locally for fast iteration:
  - cd `config/atlas_go` && `go build -o atlas .`
  - Run a single command: `./atlas fastscan` or `./atlas deepscan`.
- Run container similar to production when testing network behavior (required caps and socket):
  - docker run --network=host --cap-add=NET_RAW --cap-add=NET_ADMIN -v /var/run/docker.sock:/var/run/docker.sock -e ATLAS_UI_PORT=8884 -e ATLAS_API_PORT=8885 keinstien/atlas:pr-62
- Inspect DB state: `sqlite3 /config/db/atlas.db` inside the running container.
- Check logs: `/config/logs/deep_scan_progress.log`, `/config/logs/nmap_tcp_<ip>.log`.

5) Env vars and runtime knobs
- See `Dockerfile` and `README.md` for defaults. Important ones:
  - `ATLAS_UI_PORT` (UI/Nginx), `ATLAS_API_PORT` (FastAPI)
  - `FASTSCAN_INTERVAL`, `DOCKERSCAN_INTERVAL`, `DEEPSCAN_INTERVAL` (seconds)
  - `SCAN_SUBNETS` — comma-separated override; otherwise interfaces are auto-detected.

6) Safety and runtime expectations
- Code assumes the container has host network access and tools installed. If a developer runs locally without those tools, mocks or stubs are required.
- Many scan functions call external CLIs; keep parsing robust to missing/changed output and prefer small, isolated changes.

  7) Test changes quickly (deploy.sh)
  - Use `./deploy.sh` to build the React UI, write `data/html/build-info.json`, build the Docker image, and run a local container on host network.
  - The script never tags images as `latest`. Pushing to Docker Hub is optional and only occurs if you answer `y` when prompted.
  - Non-interactive example (no push):
    - `printf "pr-62\nn\n" | ./deploy.sh`
  - After it starts, open:
    - Local UI: `http://localhost:8884/`
    - Swagger via Nginx: `http://localhost:8884/api/docs`
  - You can tag/push by answering `y` to prompts, or pipe `y` values in the printf.

  8) Small checklist when making changes
- Update or respect DB schema and `ON CONFLICT` keys (ip + interface_name for hosts).
- If changing interface/subnet discovery, run manual validation: multiple interfaces with different subnets (see issue 27). Confirm entries are created for each interface in `/config/db/atlas.db`.
- Keep parse helpers (nmap/docker inspect) in internal/scan; add unit tests for any regex/json parsing you change.

  9) Useful references in the repo
- `config/atlas_go/main.go` (CLI entrypoints)
- `config/atlas_go/internal/scan/fastscan.go`
- `config/atlas_go/internal/scan/deep_scan.go`
- `config/atlas_go/internal/scan/docker_scan.go`
- `config/nginx/default.conf.template`
- `data/react-ui/package.json` (dev/build commands)
- `deploy.sh` (CI build/publish flow)
- `Dockerfile` (container layout and runtime env vars)
- Issue that motivated recent change: https://github.com/karam-ajaj/atlas/issues/27 (multi-interface scanning, fixed by PRs 61 and 62 — check `pr-62` image/tag while testing)

If anything in this file is unclear or you want more examples (DB schema, specific SQL statements, or how the UI expects API responses), tell me which area and I will expand with a minimal example.
