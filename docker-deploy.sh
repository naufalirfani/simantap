#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Deploying app from ${DIR} using docker compose..."

# Stop any running containers (ignore errors)
docker compose down || true

# Try to pull images (if image sources exist), ignore failures
docker compose pull || true

# Build and start
docker compose up -d --build
