#!/bin/bash

echo "🔧 Atlas CI/CD Deployment Script"

# Prompt for version
read -p "👉 Enter the version tag (e.g. v3.1): " VERSION

if [[ -z "$VERSION" ]]; then
  echo "❌ Version tag is required. Exiting..."
  exit 1
fi

echo "📦 Starting deployment for version: $VERSION"

# Step 1: Build React UI
echo "🛠️ Building React UI..."
cd /swarm/data/atlas/react-ui || exit 1
npm run build || exit 1

# Step 2: Copy UI to Nginx HTML directory
echo "📂 Copying UI build to HTML directory..."
cp -r dist/* /swarm/data/atlas/html/

# Step 3: Stop and remove existing container
echo "🧹 Removing existing 'atlas' container if running..."
docker rm -f atlas >/dev/null 2>&1 || true

# Step 4: Backup the repo
echo "🗃️ Backing up Git repo..."
/home/karam/atlas-repo-backup.sh

# Step 5: Build Docker image
echo "🐳 Building Docker image: keinstien/atlas:$VERSION"
cd /swarm/github-repos/atlas || exit 1
docker build -t keinstien/atlas:$VERSION . || exit 1

# Tag and push latest
echo "🔄 Tagging Docker image as latest"
docker tag keinstien/atlas:$VERSION keinstien/atlas:latest

# Step 6: Push both tags to Docker Hub
echo "📤 Pushing Docker image to Docker Hub..."
docker push keinstien/atlas:$VERSION || exit 1
docker push keinstien/atlas:latest || exit 1

# Step 7: Run new container
echo "🚀 Deploying container..."
docker run -d \
  --name atlas \
  --network=host \
  --cap-add=NET_RAW \
  --cap-add=NET_ADMIN \
  -v /var/run/docker.sock:/var/run/docker.sock \
  keinstien/atlas:$VERSION || exit 1

echo "✅ Deployment complete for version: $VERSION"