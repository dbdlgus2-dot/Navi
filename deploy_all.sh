#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "❌ 실패: line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

REPO_DIR="$HOME/Navi"
BRANCH="main"

GITHUB_KEY="$HOME/.ssh/id_ed25519_github"

SERVER_USER="opc"
# ✅ 지금 살아있는 인스턴스 공인IP로 수정
SERVER_HOST="130.162.142.45"
SERVER_KEY="$HOME/.ssh/ssh-key-2025-12-19.key"

SERVER_SSH_OPTS=(-i "$SERVER_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=7)

cd "$REPO_DIR"

echo "==[1/6] origin 최신화"
git fetch origin

echo "==[2/6] 상태 확인"
git status -sb

echo "==[3/6] commit/push (변경 있을 때만)"
if ! git diff --quiet || [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "chore: deploy $(date '+%Y-%m-%d %H:%M:%S')" || true

  GIT_SSH_COMMAND="ssh -i \"$GITHUB_KEY\" -o IdentitiesOnly=yes" \
    git push origin "$BRANCH"
else
  echo "ℹ️ 변경 없음"
fi

echo "==[4/6] 서버 deploy 실행"
ssh "${SERVER_SSH_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "bash ~/deploy.sh"

echo "✅ 전체 완료"