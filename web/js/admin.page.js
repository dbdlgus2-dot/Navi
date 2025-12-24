// web/js/admin.page.js
import { $ } from "./util.js";

let selectedId = null;

async function apiFetch(url, opt = {}) {
  const r = await fetch(url, { credentials: "include", ...opt });
  const data = await r.json().catch(() => ({}));

  if (r.status === 401) {
    alert("로그인이 필요합니다.");
    location.href = "/";
    return null;
  }
  if (r.status === 403) {
    alert("관리자만 접근 가능합니다.");
    location.href = "/records";
    return null;
  }
  if (!r.ok) throw new Error(data.message || "요청 실패");
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

  // 첫 항목 자동 선택
  selectedId = list[0].id;
  renderDetail(list[0]);
  ul.querySelector("button")?.classList.add("active");
}

function addDaysYMD(ymd, days) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function renderDetail(u) {
  const box = $("#adminDetail");
  const joined = (u.joined_at || "").slice(0, 10);
  const lastPay = (u.last_payment_at || "").slice(0, 10);
  const paidUntil = (u.paid_until || "").slice(0, 10);

  box.innerHTML = `
    <div class="p-3">
      <div class="mb-2"><b>${u.name}</b> <span class="text-muted">(${u.login_id})</span></div>
      <div class="text-muted small mb-3">전화: ${u.phone || "-"} / 이메일: ${u.email || "-"}</div>

      <div class="row g-2">
        <div class="col-md-4">
          <label class="form-label">계정 권한</label>
          <select id="adminRole" class="form-select">
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        <div class="col-md-4">
          <label class="form-label">계정 활성화</label>
          <select id="adminActive" class="form-select">
            <option value="true">활성</option>
            <option value="false">정지</option>
          </select>
        </div>

        <div class="col-md-4">
          <label class="form-label">가입일</label>
          <input class="form-control" value="${joined}" disabled />
        </div>

        <div class="col-md-6">
          <label class="form-label">결제일(시작일)</label>
          <input id="adminLastPay" type="date" class="form-control" value="${lastPay}" />
        </div>

        <div class="col-md-6">
          <label class="form-label">사용기간(만료일)</label>
          <input id="adminPaidUntil" type="date" class="form-control" value="${paidUntil}" />
          <div class="small text-muted mt-1">규칙: 가입일 + 30일</div>
        </div>

        <div class="col-12">
          <label class="form-label">정지 사유</label>
          <input id="adminSuspendReason" class="form-control" value="${u.suspend_reason || ""}" />
        </div>
      </div>

      <div class="mt-3 d-flex gap-2">
        <button id="btnSave" class="btn btn-primary">저장</button>
        <button id="btnReload" class="btn btn-outline-secondary">새로고침</button>
      </div>
    </div>
  `;

  $("#adminRole").value = u.role || "USER";
  $("#adminActive").value = String(!!u.is_active);

  // ✅ 결제일 바꾸면 "가입일 기준 만료일(=가입일+30일)"로 자동 세팅하려면:
  // 요구사항이 "결제일 기준"이 아니라 "가입일로부터 +30일" 이라서
  // 결제일 변경과 무관하게 paid_until을 joined+30으로 맞추는게 맞음.
  $("#adminLastPay")?.addEventListener("change", () => {
    if (joined) $("#adminPaidUntil").value = addDaysYMD(joined, 30);
  });

  $("#btnSave").addEventListener("click", onSave);
  $("#btnReload").addEventListener("click", loadUsers);
}

async function loadUsers() {
  const q = ($("#adminQ")?.value || "").trim();
  const list = await apiFetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
  if (!list) return;
  renderList(list);
}

async function onSave() {
  if (!selectedId) return;

  const payload = {
    role: $("#adminRole").value,
    is_active: $("#adminActive").value === "true",
    last_payment_at: $("#adminLastPay").value || null,
    paid_until: $("#adminPaidUntil").value || null,
    suspend_reason: ($("#adminSuspendReason").value || "").trim() || null,
  };

  const r = await apiFetch(`/api/admin/users/${selectedId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r) return;

  alert("저장 완료");
  await loadUsers();
}

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await ensureAdmin();
  if (!ok) return;

  $("#btnAdminSearch")?.addEventListener("click", loadUsers);
  $("#adminQ")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadUsers();
  });

  await loadUsers();
});