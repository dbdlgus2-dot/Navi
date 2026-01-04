#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "❌ 실패: line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

REPO_DIR="$HOME/Navi"
BRANCH="main"

# GitHub push용 키(로컬 맥)
GITHUB_KEY="$HOME/.ssh/id_ed25519_github"

# 서버 접속 정보(로컬 맥에서 ssh로 접속)
SERVER_HOST="161.33.167.129"
SERVER_USER="opc"
SERVER_KEY="$HOME/.ssh/ssh-key-2025-12-19.key"

# 서버에서 실행할 스크립트 경로
SERVER_DEPLOY_SCRIPT="~/deploy.sh"

SERVER_SSH_OPTS=(-i "$SERVER_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)

cd "$REPO_DIR"

echo "==[1/6] 키 체크"
test -f "$GITHUB_KEY"
test -f "$SERVER_KEY"
chmod 600 "$GITHUB_KEY" "$SERVER_KEY" 2>/dev/null || true

echo "==[2/6] origin 최신화"
git fetch origin

echo "==[3/6] 상태 확인"
git status -sb

# 로그파일 실수로 올라가는거 방지
rm -f deploy_local.log deploy_all.log 2>/dev/null || true

echo "==[4/6] commit/push (변경 있을 때만)"
if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  git add -A
  MSG="${1:-chore: deploy $(date '+%Y-%m-%d %H:%M:%S')}"
  git commit -m "$MSG" || true

  # ✅ GitHub push는 이 키만 쓰도록 강제
  GIT_SSH_COMMAND="ssh -i \"$GITHUB_KEY\" -o IdentitiesOnly=yes" \
    git push origin "$BRANCH"
else
  echo "ℹ️ 변경사항 없음 → push 스킵"
fi

echo "==[5/6] 서버 deploy.sh 업데이트 + 실행"
ssh "${SERVER_SSH_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "bash -lc 'cat > $SERVER_DEPLOY_SCRIPT <<\"EOF\"
#!/usr/bin/env bash
set -Eeuo pipefail
trap \"echo \\\"❌ 실패: line=\\\$LINENO cmd=\\\$BASH_COMMAND\\\" >&2\" ERR

APP_DIR=\\\"\\\$HOME/apps/Navi\\\"
API_DIR=\\\"\\\$APP_DIR/node-api\\\"
PM2_NAME=\\\"navi-api\\\"

echo \\\"==[1/7] 이동\\\"
cd \\\"\\\$APP_DIR\\\"

echo \\\"==[2/7] git 상태 확인\\\"
git status -sb || true

echo \\\"==[3/7] 원격 최신 가져오기 + 강제 동기화(origin/main 기준)\\\"
git fetch origin
git reset --hard origin/main

echo \\\"==[4/7] node-api 의존성 설치\\\"
cd \\\"\\\$API_DIR\\\"
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

echo \\\"==[5/7] PM2 재시작(없으면 start)\\\"
if pm2 describe \\\"\\\$PM2_NAME\\\" >/dev/null 2>&1; then
  pm2 restart \\\"\\\$PM2_NAME\\\" --update-env
else
  pm2 start \\\"\\\$API_DIR/server.js\\\" --name \\\"\\\$PM2_NAME\\\" --cwd \\\"\\\$API_DIR\\\"
fi
pm2 save

echo \\\"==[6/7] 헬스체크\\\"
curl -sS http://127.0.0.1:3000/api/health/db || true
echo

echo \\\"==[7/7] pm2 list\\\"
pm2 list

echo \\\"✅ deploy 완료\\\"
EOF
chmod +x $SERVER_DEPLOY_SCRIPT
bash -lc $SERVER_DEPLOY_SCRIPT
'"

echo "✅ 완료"