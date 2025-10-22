#!/bin/bash
set -euo pipefail

echo "🔧 Atlas CI/CD Deployment Script"

### Sync docker group membership for current session (avoid infinite recursion)
# Resolve absolute path to this script for re-exec
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "$0")"
if [[ -z "${ATLAS_IN_SG:-}" ]]; then
  if command -v id >/dev/null 2>&1 && id -nG 2>/dev/null | grep -qw docker; then
    echo "✅ Docker group already present; continuing..."
  elif command -v sg >/dev/null 2>&1; then
    echo "🔄 Syncing docker group membership..."
    # Reconstruct quoted args safely
    QUOTED_ARGS=()
    for arg in "$@"; do
      QUOTED_ARGS+=("$(printf '%q' "$arg")")
    done
    CMD="ATLAS_IN_SG=1 \"$SCRIPT_PATH\" ${QUOTED_ARGS[*]}"
    exec sg docker -c "$CMD"
  else
    echo "⚠️ 'sg' command not available; proceeding without group switch"
  fi
else
  echo "✅ Running under docker group context"
fi

# Resolve repo root from this script's location
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_DIR="${REPO_ROOT}/data/react-ui"
HTML_DIR="${REPO_ROOT}/data/html"
IMAGE="keinstien/atlas"
CONTAINER_NAME="atlas-dev"
CURRENT_VERSION=$(awk -F'"' '{print $4}' $HTML_DIR/build-info.json)

echo "📁 Repo root: $REPO_ROOT"
echo "🧩 UI dir:    $UI_DIR"
echo "🗂️  HTML dir:   $HTML_DIR"

# Prompt for version (allow env override)
if [[ -z "${VERSION:-}" ]]; then
  read -p "👉 Enter the version tag (current version: $CURRENT_VERSION): " VERSION
fi
if [[ -z "${VERSION:-}" ]]; then
  echo "❌ Version tag is required. Exiting..."
  exit 1
fi

# Ask whether to also tag this version as 'latest' (allow env override)
if [[ -z "${TAG_LATEST:-}" ]]; then
  read -p "👉 Tag this version as 'latest' as well? (y/N): " TAG_LATEST
fi
if [[ "${TAG_LATEST:-}" =~ ^([yY][eE][sS]|[yY])$ ]]; then
  DO_LATEST=true
else
  DO_LATEST=false
fi

# Ask whether to push this version to Docker Hub (allow env override via PUSH_D or DO_PUSH)
if [[ -z "${PUSH_D:-}" && -z "${DO_PUSH:-}" ]]; then
  read -p "👉 Push this version to Docker Hub? (y/N): " PUSH_D
fi
if [[ "${PUSH_D:-}" =~ ^([yY][eE][sS]|[yY])$ || "${DO_PUSH:-}" =~ ^([tT][rR][uU][eE]|[yY][eE][sS]|[yY])$ ]]; then
  DO_PUSH=true
else
  DO_PUSH=false
fi

# Sanity checks
command -v docker >/dev/null 2>&1 || { echo "❌ docker is not installed or not in PATH"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is not installed or not in PATH"; exit 1; }
[[ -d "$UI_DIR" ]] || { echo "❌ React UI directory not found at: $UI_DIR"; exit 1; }

echo "📦 Starting deployment for version: $VERSION"

# Step 1: Build React UI from repo's data/react-ui
echo "🛠️ Building React UI..."
pushd "$UI_DIR" >/dev/null
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
npm run build
popd >/dev/null

# Step 2: Copy UI build output to data/html (used by Dockerfile)
echo "📂 Copying UI build to data/html..."
mkdir -p "$HTML_DIR"
rm -rf "${HTML_DIR:?}/"* 2>/dev/null || true
cp -r "$UI_DIR/dist/"* "$HTML_DIR/"

# Step 2b: Write build-info.json for the UI to display
echo "📝 Writing build-info.json..."
COMMIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'dirty')"
BUILD_TIME="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
cat > "${HTML_DIR}/build-info.json" <<EOF
{ "version": "${VERSION}", "commit": "${COMMIT_SHA}", "builtAt": "${BUILD_TIME}" }
EOF

# Step 3: Stop and remove existing container if present
echo "🧹 Removing existing '$CONTAINER_NAME' container if running..."
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

# Step 4: (Optional) backup disabled by default. Enable by exporting RUN_BACKUP=1
if [[ "${RUN_BACKUP:-0}" == "1" && -x "/home/karam/atlas-repo-backup.sh" ]]; then
  echo "🗃️ Running backup script..."
  /home/karam/atlas-repo-backup.sh || echo "⚠️ Backup script returned non-zero exit; continuing..."
else
  echo "ℹ️ Skipping backup (set RUN_BACKUP=1 to enable and ensure script exists)"
fi

# Step 5: Build Docker image from repo root
echo "🐳 Building Docker image: $IMAGE:$VERSION"
DOCKER_BUILDKIT=1 docker build -t "$IMAGE:$VERSION" "$REPO_ROOT"

# Step 5b: Optionally tag as latest
if $DO_LATEST; then
  echo "🔄 Tagging Docker image as latest"
  docker tag "$IMAGE:$VERSION" "$IMAGE:latest"
else
  echo "⏭️ Skipping 'latest' tag per selection"
fi

# Step 6: Push image(s) to Docker Hub
if ! $DO_PUSH; then
  echo "⏭️ Skipping Docker push as requested"
  # exit 0
else
  echo "📤 Pushing Docker image(s) to Docker Hub..."
  docker push "$IMAGE:$VERSION"
  if $DO_LATEST; then
    docker push "$IMAGE:latest"
  fi
fi

# Step 7: Run new container
echo "🚀 Deploying container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --network=host \
  --cap-add=NET_RAW \
  --cap-add=NET_ADMIN \
  -e ATLAS_UI_PORT=8884 \
  -e ATLAS_API_PORT=8885 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  "$IMAGE:$VERSION"

if $DO_LATEST; then
  echo "✅ Deployment complete for version: $VERSION (also tagged as latest)"
else
  echo "✅ Deployment complete for version: $VERSION"
fi