#!/bin/bash
#
# deploy.sh — DraftSense deployment script.
# Run on the VPS from the repo root. Handles first deploy AND updates.
#
# Usage:
#   ./deploy.sh         # normal: git pull + build + restart + healthcheck
#   ./deploy.sh --skip-pull   # skip git pull (e.g. after manually editing .env)
#

set -e

echo "🚀 DraftSense deploy start..."

cd "$(dirname "$0")" || exit 1

# ── .env check ──────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "❌ Brak pliku .env!"
  echo "   Skopiuj .env.example → .env i uzupełnij RIOT_API_KEY, PUBLIC_DOMAIN, ACME_EMAIL."
  exit 1
fi

# Load env vars for the checks below + for post-deploy output
set -a
source .env
set +a

if [ -z "${RIOT_API_KEY:-}" ] || [ "${RIOT_API_KEY}" = "RGAPI-replace-me" ]; then
  echo "❌ RIOT_API_KEY jest pusty lub to nadal placeholder. Edytuj .env."
  exit 1
fi
if [ -z "${PUBLIC_DOMAIN:-}" ]; then
  echo "❌ PUBLIC_DOMAIN jest pusty w .env."
  exit 1
fi
if [ -z "${ACME_EMAIL:-}" ]; then
  echo "❌ ACME_EMAIL jest pusty w .env."
  exit 1
fi

# ── Git pull ────────────────────────────────────────────────────────────────
if [ "${1:-}" != "--skip-pull" ]; then
  echo "📥 Pull z GitHub..."
  git pull origin main
fi

# ── Build + restart ─────────────────────────────────────────────────────────
echo "🔨 Build kontenerów Dockera (backend + frontend + caddy)..."
docker compose up -d --build

# ── Healthcheck backendu ────────────────────────────────────────────────────
echo "⏳ Czekam aż backend będzie healthy (max 90s)..."
for i in {1..45}; do
  status=$(docker inspect -f '{{.State.Health.Status}}' lolbuild-api 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    echo "✅ Backend healthy"
    break
  fi
  if [ $i -eq 45 ]; then
    echo "⚠️  Backend nie stał się healthy w 90s. Sprawdź logi:"
    echo "    docker compose logs backend --tail=100"
    exit 1
  fi
  sleep 2
done

# ── Cleanup ─────────────────────────────────────────────────────────────────
echo "🧹 Czyszczenie dangling obrazów..."
docker image prune -f > /dev/null

# ── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "✅ Deploy zakończony!"
echo "🌐 https://${PUBLIC_DOMAIN}"
echo "🩺 curl https://${PUBLIC_DOMAIN}/health"
echo "📋 docker compose logs -f"
