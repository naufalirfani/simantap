#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Deploying app from ${DIR} using docker compose..."

# Stop any running containers (ignore errors)
docker compose down || true

# If this is a git repository, pull latest code
if [ -d "$DIR/.git" ]; then
	echo "Pulling latest code from git..."
	git -C "$DIR" pull --rebase
else
	echo "No .git directory found; skipping git pull"
fi

# Capture previous simantap-app image IDs (if any)
PREV_IDS=$(docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | awk '/^simantap-app:/{print $2}' | sort -u || true)
echo "Previous simantap-app image IDs: ${PREV_IDS:-<none>}"

# Build and start (rebuild image)
docker compose up -d --build

# Capture new simantap-app image IDs
NEW_IDS=$(docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | awk '/^simantap-app:/{print $2}' | sort -u || true)
echo "New simantap-app image IDs: ${NEW_IDS:-<none>}"

# Remove images that existed before but are not present after the deploy
for id in $PREV_IDS; do
	if [ -n "$id" ] && ! echo "$NEW_IDS" | grep -q "^$id$"; then
		echo "Removing old image $id"
		docker rmi "$id" || echo "Failed to remove image $id (might be in use)"
	fi
done

# Clean up dangling images
docker image prune -f || true
