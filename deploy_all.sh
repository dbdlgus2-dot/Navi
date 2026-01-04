#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "❌ 실패: line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

REPO_DIR="$HOME/Navi"
BRANCH="main"

# GitHub push용 키
GITHUB_KEY="$HOME/.ssh/id_ed25519_github"

# 서버 정보
SERVER_HOST="161.33.167.129"
SERVER_USER="opc"
SERVER_KEY="$HOME/.ssh/ssh-key-2025-12-19.key"
SERVER_DEPLOY_SCRIPT="/home/opc/deploy.sh"

# ssh 옵션
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

echo "==[4/6] commit/push (변경 있을 때만)"
NEED_PUSH=0
if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  NEED_PUSH=1
  git add -A
  MSG="${1:-chore: deploy $(date '+%Y-%m-%d %H:%M:%S')}"
  git commit -m "$MSG" || true
fi

echo "==[5/6] push (GitHub 키 강제)"
if [[ "$NEED_PUSH" -eq 1 ]]; then
  GIT_SSH_COMMAND="ssh -i \"$GITHUB_KEY\" -o IdentitiesOnly=yes" \
    git push origin "$BRANCH"
else
  echo "ℹ️ 변경사항 없음 → push 스킵"
fi

echo "==[6/6] 서버 deploy.sh 업데이트 + 실행"

ssh "${SERVER_SSH_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "bash -lc 'cat > $SERVER_DEPLOY_SCRIPT <<\"EOF\"
#!/usr/bin/env bash
set -Eeuo pipefail
trap \"echo \\\"❌ 실패: line=\\\$LINENO cmd=\\\$BASH_COMMAND\\\" >&2\" ERR

PM2_NAME=\"navi-api\"
APP_DIR=\"/home/opc/apps/Navi\"
API_DIR=\"\$APP_DIR/node-api\"
PORT=\"3000\"

echo \"==[1/8] 경로 확인\"
if [ ! -d \"\$APP_DIR\" ]; then
  echo \"❌ APP_DIR 없음: \$APP_DIR\" >&2
  echo \"   (서버에 /home/opc/apps/Navi가 실제 있는지 확인 필요)\" >&2
  exit 1
fi

echo \"==[2/8] 이동: \$APP_DIR\"
cd \"\$APP_DIR\"

echo \"==[3/8] git 상태(배포 전)\"
git status -sb || true

echo \"==[4/8] 원격 최신 가져오기 + 강제 동기화(origin/main 기준)\"
git fetch origin
git reset --hard origin/main
git clean -fd

echo \"==[5/8] node-api 의존성 설치\"
cd \"\$API_DIR\"
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

echo \"==[6/8] PM2 재기동(확실하게 delete 후 start)\"
pm2 delete \"\$PM2_NAME\" >/dev/null 2>&1 || true
pm2 start \"\$API_DIR/server.js\" --name \"\$PM2_NAME\" --cwd \"\$API_DIR\"
pm2 save

echo \"==[7/8] 헬스체크(최대 10초 재시도)\"
ok=0
for i in 1 2 3 4 5; do
  if curl -sS \"http://127.0.0.1:\$PORT/api/health/db\" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [ \"\$ok\" -eq 1 ]; then
  curl -sS \"http://127.0.0.1:\$PORT/api/health/db\" || true
  echo
else
  echo \"⚠️ 헬스체크 실패: 127.0.0.1:\$PORT 연결 불가\" >&2
  echo \"--- pm2 last logs ---\" >&2
  pm2 logs \"\$PM2_NAME\" --lines 60 --nostream || true
fi

echo \"==[8/8] pm2 list\"
pm2 list

echo \"✅ deploy 완료\"
EOF
chmod +x $SERVER_DEPLOY_SCRIPT
bash -lc $SERVER_DEPLOY_SCRIPT
'"

echo "✅ 로컬 deploy_all.sh 완료"