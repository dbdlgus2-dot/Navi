#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "❌ 실패: line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

REPO_DIR="$HOME/Navi"
BRANCH="main"

# GitHub push용 키
GITHUB_KEY="$HOME/.ssh/id_ed25519_github"

# 서버 접속용
SERVER_HOST="161.33.167.129"
SERVER_USER="opc"
SERVER_KEY="$HOME/.ssh/ssh-key-2025-12-19.key"

# 서버에서 실행할 배포 스크립트(원격 홈 기준)
SERVER_DEPLOY_SCRIPT="~/deploy.sh"

# ssh 옵션(서버용)
SERVER_SSH_OPTS=(-i "$SERVER_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)

cd "$REPO_DIR"

echo "==[1/6] 키 체크"
[[ -f "$GITHUB_KEY" ]] || { echo "❌ GitHub key 없음: $GITHUB_KEY"; exit 1; }
[[ -f "$SERVER_KEY" ]] || { echo "❌ Server key 없음: $SERVER_KEY"; exit 1; }
chmod 600 "$GITHUB_KEY" "$SERVER_KEY" 2>/dev/null || true

echo "==[2/6] origin 최신화"
git fetch origin

echo "==[3/6] 상태 확인"
git status -sb

# 로그파일 실수로 올라가는거 방지
rm -f deploy_local.log deploy_all.log 2>/dev/null || true

echo "==[4/6] commit/push (변경 있을 때만)"
HAS_CHANGES=0
if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  HAS_CHANGES=1
fi

if [[ "$HAS_CHANGES" -eq 1 ]]; then
  git add -A
  MSG="${1:-chore: deploy $(date '+%Y-%m-%d %H:%M:%S')}"
  git commit -m "$MSG" || true

  echo "==[5/6] push (GitHub 키 강제)"
  export GIT_SSH_COMMAND="ssh -i $GITHUB_KEY -o IdentitiesOnly=yes"
  git push origin "$BRANCH"
  unset GIT_SSH_COMMAND
else
  echo "ℹ️ 변경사항 없음 → commit/push 스킵"
fi

echo "==[6/6] 서버 deploy.sh 실행"
ssh "${SERVER_SSH_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "bash -lc '$SERVER_DEPLOY_SCRIPT'"

echo "✅ 완료"