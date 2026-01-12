import { $ } from "./util.js";

let selectedId = null;

async function apiFetch(url, opt = {}) {
  const r = await fetch(url, { credentials: "include", ...opt });
  let data = {};
  try { data = await r.json(); } catch (_) { data = {}; }

  if (r.status === 401) { alert("로그인이 필요합니다."); location.href = "/"; return null; }
  if (r.status === 403) { alert("관리자만 접근 가능합니다."); location.href = "/records"; return null; }
  if (!r.ok) throw new Error(data.message || `요청 실패 (${r.status})`);
  return data;
}

async function ensureAdmin() {
  const me = await apiFetch("/api/me");
  if (!me) return false;
  if (me.role !== "ADMIN") {
    alert("관리자만 접근 가능합니다.");
    location.href = "/records";
    return false;
  }
  return true;
}

function renderList(list) {
  const ul = $("#adminUserList");
  ul.innerHTML = "";
  if (!list?.length) {
    ul.innerHTML = `<div class="p-3 text-muted">검색 결과 없음</div>`;
    $("#adminDetail").innerHTML = "";
    return;
  }

  list.forEach((u) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "list-group-item list-group-item-action";
    btn.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div><b>${u.name}</b> (${u.login_id})</div>
        <div class="small text-muted">${u.role}</div>
      </div>
      <div class="small text-muted">${u.phone || ""}</div>
    `;
    btn.addEventListener("click", () => {
      selectedId = u.id;
      renderDetail(u);
      ul.querySelectorAll(".active").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
    });
    ul.appendChild(btn);
  });

  selectedId = list[0].id;
  renderDetail(list[0]);
  ul.querySelector("button")?.classList.add("active");
}

function normalizeYMD(s) {
  if (!s) return "";
  s = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/);
  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }
  return "";
}

function addDaysYMD(ymd, days = 30) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function renderDetail(u) {
  const box = $("#adminDetail");
  const joined = normalizeYMD((u.joined_at || "").slice(0, 10));
  const lastPay = normalizeYMD((u.last_payment_at || "").slice(0, 10));
  const paidUntil = normalizeYMD((u.paid_until || "").slice(0, 10));

  box.innerHTML = `
    <div class="p-3">
      <div class="mb-2"><b>${u.name}</b> <span class="text-muted">(${u.login_id})</span></div>
      <div class="row g-2">
        <div class="col-md-4"><label class="form-label">계정 권한</label><select id="adminRole" class="form-select"><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select></div>
        <div class="col-md-4"><label class="form-label">계정 활성화</label><select id="adminActive" class="form-select"><option value="true">활성</option><option value="false">정지</option></select></div>
        <div class="col-md-4"><label class="form-label">가입일</label><input class="form-control" value="${joined}" disabled /></div>
        <div class="col-md-6"><label class="form-label">로그인ID</label><input id="adminLoginId" class="form-control" value="${u.login_id || ""}" /></div>
        <div class="col-md-6"><label class="form-label">이름</label><input id="adminName" class="form-control" value="${u.name || ""}" /></div>
        <div class="col-md-6"><label class="form-label">비밀번호 변경</label><input id="adminPassword" type="password" class="form-control" placeholder="변경 시에만 입력" autocomplete="new-password" /></div>
        <div class="col-md-6"><label class="form-label">결제일</label><input id="adminLastPay" type="date" class="form-control" value="${lastPay}" /></div>
        <div class="col-md-6"><label class="form-label">만료일</label><input id="adminPaidUntil" type="date" class="form-control" value="${paidUntil}" /></div>
      </div>
   <div class="p-3">
      <div class="mt-3 d-flex gap-2">
        <button id="btnSave" class="btn btn-primary">저장</button>
        <button id="btnReload" class="btn btn-outline-secondary">새로고침</button>
      </div>
      <div class="mt-4 pt-3 border-top">
        <button id="btnImpersonate" class="btn btn-warning w-100">👤 이 사용자로 대리 로그인</button>
      </div>
    </div>
  `;

  // 초기값 세팅
  $("#adminRole").value = u.role || "USER";
  $("#adminActive").value = String(!!u.is_active);

  // 이벤트 연결 (함수 내부에서 수행)
  $("#btnSave").onclick = onSave;
  $("#btnReload").onclick = loadUsers;
  
$("#btnImpersonate").onclick = async () => {
    if (!confirm(`${u.name} 계정으로 접속하시겠습니까?`)) return;
    try {
      // 성공 알림 기능 포함
      const r = await apiFetch(`/api/admin/impersonate/${u.id}`, { method: "POST" });
      if (r?.success) {
        alert(r.message || "사용자 계정으로 전환합니다."); 
        location.href = r.redirectUrl;
      }
    } catch (e) { alert("접속 실패: " + e.message); }
  };
}

async function loadUsers() {
  const q = ($("#adminQ")?.value || "").trim();
  const list = await apiFetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
  if (list) renderList(list);
}

async function onSave() {
  if (!selectedId) return;
  const payload = {
    login_id: $("#adminLoginId")?.value?.trim(),
    name: $("#adminName")?.value?.trim(),
    role: $("#adminRole").value,
    is_active: $("#adminActive").value === "true",
    last_payment_at: $("#adminLastPay").value || null,
    paid_until: $("#adminPaidUntil").value || null,
  };
  const pw = $("#adminPassword")?.value?.trim();
  if (pw) payload.password = pw;

  try {
    const r = await apiFetch(`/api/admin/users/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r) { alert("저장 완료"); await loadUsers(); }
  } catch (e) { alert("저장 실패: " + e.message); }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (await ensureAdmin()) {
    $("#btnAdminSearch")?.addEventListener("click", loadUsers);
    $("#adminQ")?.addEventListener("keydown", (e) => { if (e.key === "Enter") loadUsers(); });
    await loadUsers();
  }
});

// routes/admin.js

// 1. 대리 로그인 (기존 코드 수정)
router.post('/impersonate/:userId', async (req, res) => {
    try {
        if (!req.session?.user || req.session.user.role !== 'ADMIN') {
            return res.status(403).json({ message: "권한이 없습니다." });
        }

        const targetId = Number(req.params.userId);
        const { rows } = await pool.query("SELECT * FROM app_users WHERE id = $1", [targetId]);
        const targetUser = rows[0];

        if (!targetUser) return res.status(404).json({ message: "유저 없음" });

        // 원래 관리자 정보를 세션에 임시 저장 (복귀용)
        req.session.adminId = req.session.user.id; 

        req.session.user = {
            id: targetUser.id,
            login_id: targetUser.login_id,
            role: targetUser.role,
            name: targetUser.name,
            isImpersonated: true 
        };

        req.session.save(() => {
            // 알림 처리를 위해 success 메시지 추가
            res.json({ success: true, message: `${targetUser.name} 계정으로 접속했습니다.`, redirectUrl: "/records" });
        });
    } catch (err) {
        res.status(500).json({ message: "서버 오류" });
    }
});

// 2. 관리자로 복귀 API (새로 추가)
router.post('/exit-impersonate', async (req, res) => {
    try {
        if (!req.session.adminId) {
            return res.status(400).json({ message: "복귀할 관리자 정보가 없습니다." });
        }

        // 저장해둔 adminId로 다시 유저 정보 조회
        const { rows } = await pool.query("SELECT * FROM app_users WHERE id = $1", [req.session.adminId]);
        const adminUser = rows[0];

        req.session.user = {
            id: adminUser.id,
            login_id: adminUser.login_id,
            role: adminUser.role,
            name: adminUser.name
        };
        delete req.session.adminId; // 복귀 후 관리자 ID 삭제

        req.session.save(() => {
            res.json({ success: true, redirectUrl: "/admin" }); // 관리자 페이지로 복귀
        });
    } catch (err) {
        res.status(500).json({ message: "복귀 중 오류 발생" });
    }
});