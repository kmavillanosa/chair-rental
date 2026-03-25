#!/usr/bin/env bash
set -euo pipefail

# Force-refresh frontend containers to eliminate stale UI after deploy.
# Default behavior keeps database data intact.
#
# Usage:
#   ./vps-refresh-ui.sh
#   ./vps-refresh-ui.sh --project-dir /root/chair-rental
#   ./vps-refresh-ui.sh --prune-images
#   ./vps-refresh-ui.sh --with-api
#
# Flags:
#   --project-dir <path>  Path to project root containing docker-compose.yml
#   --prune-images        Also run docker image prune -af (slower, more aggressive)
#   --with-api            Rebuild and recreate api too
#   -h, --help            Show help

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRUNE_IMAGES="false"
WITH_API="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir)
      PROJECT_DIR="${2:-}"
      if [[ -z "$PROJECT_DIR" ]]; then
        echo "Missing value for --project-dir"
        exit 1
      fi
      shift 2
      ;;
    --prune-images)
      PRUNE_IMAGES="true"
      shift
      ;;
    --with-api)
      WITH_API="true"
      shift
      ;;
    -h|--help)
      sed -n '1,40p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

cd "$PROJECT_DIR"

if [[ ! -f "docker-compose.yml" || ! -f "docker-compose.release.yml" ]]; then
  echo "docker-compose files not found in: $PROJECT_DIR"
  exit 1
fi

compose() {
  docker compose -f docker-compose.yml -f docker-compose.release.yml "$@"
}

echo "[1/7] Stopping frontend/proxy containers"
compose stop app staff_app nginx_proxy || true

echo "[2/7] Removing frontend/proxy containers"
compose rm -f app staff_app nginx_proxy || true

echo "[3/7] Pruning Docker builder cache"
docker builder prune -af

if [[ "$PRUNE_IMAGES" == "true" ]]; then
  echo "[4/7] Pruning Docker images"
  docker image prune -af
else
  echo "[4/7] Skipping docker image prune (use --prune-images to enable)"
fi

if [[ "$WITH_API" == "true" ]]; then
  echo "[5/7] Rebuilding api/app/staff_app with no cache"
  compose build --no-cache --pull api app staff_app
else
  echo "[5/7] Rebuilding app/staff_app with no cache"
  compose build --no-cache --pull app staff_app
fi

if [[ "$WITH_API" == "true" ]]; then
  echo "[6/7] Starting api/app/staff_app/nginx_proxy with force recreate"
  compose up -d --force-recreate api app staff_app nginx_proxy
else
  echo "[6/7] Starting app/staff_app/nginx_proxy with force recreate"
  compose up -d --force-recreate app staff_app nginx_proxy
fi

echo "[7/7] Verifying deployed version files inside containers"
APP_VERSION="$(compose exec -T app sh -lc 'cat /usr/share/nginx/html/version.json 2>/dev/null || true')"
STAFF_VERSION="$(compose exec -T staff_app sh -lc 'cat /usr/share/nginx/html/version.json 2>/dev/null || true')"

if [[ -n "$APP_VERSION" ]]; then
  echo "app version.json: $APP_VERSION"
else
  echo "app version.json: <missing>"
fi

if [[ -n "$STAFF_VERSION" ]]; then
  echo "staff_app version.json: $STAFF_VERSION"
else
  echo "staff_app version.json: <missing>"
fi

echo "Done. Hard-refresh browser (Ctrl+Shift+R) or use incognito to validate UI changes."
