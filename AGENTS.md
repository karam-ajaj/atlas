# Atlas Agent Guide

Welcome! Follow these repo-specific expectations whenever you touch files under this repository.

## UI port configuration
- The UI is served by NGINX on port **8888** with API traffic proxied to 8889 (`config/nginx/default.conf`, `Dockerfile`).
- The port is configurable at deploy time, but if you change the baked-in default you **must** update:
  - `config/nginx/default.conf` (listen directives),
  - any `EXPOSE` or published port values in the Dockerfiles,
  - documentation such as `README.md` and examples in `deploy.sh` comments.
- When running locally without host networking, map the container’s 8888 to the host port you need (e.g. `-p 3000:8888`).

## Container builds (x86_64 & ARM64)
- Use the root `Dockerfile` for the standard x86_64 image published to Docker Hub.
- A dedicated **ARM64** build recipe lives alongside it as `Dockerfile.arm64`; use `docker build -f Dockerfile.arm64 .` when targeting Apple Silicon or other ARM hosts.
- Keep both Dockerfiles in lock-step: dependency versions, exposed ports, and copy steps should match unless the architecture requires a divergence. Document any intentional differences in `README.md`.

## Automation scripts you should know
- `config/scripts/atlas_check.sh` is the container entrypoint. It bootstraps FastAPI, NGINX, and the Go scanners; ensure any service/port changes stay compatible with this script.
- `deploy.sh` performs the CI/CD workflow: builds the React UI, copies artifacts into `data/html`, builds/pushes Docker images, and can redeploy a running container. Prefer invoking it (or replicating its steps) before publishing images.

## Frontend workflow
- Source lives in `data/react-ui` and compiled assets are stored in `data/html` (served by NGINX). Do **not** hand-edit files in `data/html`—regenerate them from the React project instead.
- To rebuild after frontend changes:
  ```bash
  cd data/react-ui
  npm ci   # or npm install if the lockfile changes
  npm run build
  rsync -a dist/ ../html/   # or run ./deploy.sh which automates this copy
  ```
- Commit the rebuilt `data/html` assets whenever the UI changes so the container image stays in sync.

## Documentation touchpoints
- Update `README.md` whenever you adjust ports, build commands, deploy expectations, or UI locations so users stay aligned.
- Mirror significant process changes (e.g., new scripts or environment requirements) in the in-repo documentation before shipping.
- Follow the community expectations in `CODE_OF_CONDUCT.md` for any collaborative updates.

## Testing & pre-commit expectations
- Backend (Go): `cd config/atlas_go && go fmt ./... && go test ./... && go build ./...`.
- Frontend: `cd data/react-ui && npm run build` (the build will fail on linting or type issues surfaced by Vite).
- Container: when touching Dockerfiles or entrypoint scripts, run `docker build` for each relevant target (`Dockerfile` and `Dockerfile.arm64`) to catch build regressions.
- Shell scripts: keep them POSIX-compliant and executable (`chmod +x`) if you add new ones.

## Contribution & reporting expectations
- Keep commits small, descriptive, and run the above checks before pushing.
- When summarizing work (including automated assistant outputs), cite the files and line ranges you modified and list the checks you executed. This keeps reviews quick and auditable.
- Align with the repository’s existing style and folder layout—ask before reorganizing large areas.

Thanks for helping keep Atlas consistent across architectures and UI builds!
