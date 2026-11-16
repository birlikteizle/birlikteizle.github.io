#!/usr/bin/env bash
#
# Sunucuda elle veya zamanlanmış görevle çalıştırılır: GitHub'daki en son kodu
# çeker, imajı yeniden derler ve uygulamayı yeniden başlatır.
#
# Elle:           ~/birlikte-izle/deploy/auto-pull.sh
# Zamanlanmış:    crontab -e   →   */5 * * * * /home/ubuntu/birlikte-izle/deploy/auto-pull.sh >> /home/ubuntu/auto-pull.log 2>&1
#
# Zamanlanmış görev, GitHub Actions kullanmak istemeyenler için pratiktir:
# depoya push yaptıktan sonra en fazla 5 dakika içinde site güncellenir.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

BRANCH="${DEPLOY_BRANCH:-main}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] güncelleme kontrol ediliyor..."

git fetch --all --prune --quiet

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] değişiklik yok, çıkılıyor."
  exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] yeni sürüm bulundu: ${REMOTE:0:8}"

git reset --hard "origin/$BRANCH"
docker compose up -d --build
docker image prune -f

echo "[$(date '+%Y-%m-%d %H:%M:%S')] güncelleme tamamlandı."
