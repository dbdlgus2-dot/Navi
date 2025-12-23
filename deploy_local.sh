#!/usr/bin/env bash
set -euo pipefail

# ====== 수정해서 쓰는 값들 ======
REPO_DIR="${REPO_DIR:-$HOME/Navi}"          # 로컬 Navi 경로
BRANCH="${BRANCH:-main}"                   # 푸시할 브랜치
SERVER_USER="${SERVER_USER:-opc}"
SERVER_HOST="${SERVER_HOST:-161.33.167.129}"
SERVER_PORT="${SERVER_PORT:-22}"
SERVER_DEPLOY_SCRIPT="${SERVER_DEPLOY_SCRIPT:-~/deploy.sh}"  # 서버 배포 스크립트
# ===============================

cd "$REPO_DIR"

echo "==[1/6] 변경사항 확인"
git status -sb

# 변경 없으면 바로 서버 배포만 할지 선택
if git diff --quiet && git diff --cached --quiet; then
  echo "변경사항 없음. 서버 배포만 진행합니다."
else
  echo "==[2/6] add"
  git add -A

  echo "==[3/6] commit"
  MSG="${1:-"chore: deploy $(date +'%Y-%m-%d %H:%M:%S')"}"
  git commit -m "$MSG" || echo "(커밋할 변경이 없어서 스킵)"

  echo "==[4/6] push origin/$BRANCH"
  git push origin "$BRANCH"
fi

echo "==[5/6] 서버에서 배포 스크립트 실행"
ssh -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_HOST}" "bash -lc '$SERVER_DEPLOY_SCRIPT'"

echo "==[6/6] DONE ✅"
