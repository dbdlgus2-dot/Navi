#!/usr/bin/env bash
set -euo pipefail

MSG="${1:-deploy: update}"
SERVER="opc@161.33.167.129"
REMOTE_DIR="~/Navi"

echo "==[1] git status =="
git status --porcelain

echo "==[2] git add/commit =="
git add -A
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$MSG"
fi

echo "==[3] git push =="
git push origin main

echo "==[4] deploy on server =="
ssh "$SERVER" "bash -lc '$REMOTE_DIR/server-deploy.sh'"

echo "✅ local push + server deploy done"
