window.NAVI = window.NAVI || {};

// ❗ 여기서만 선언
const $ = (sel) => document.querySelector(sel);

// ✅ 아이디 뒤 3자리 마스킹
function maskLoginId(id) {
  if (!id) return "";
  const s = String(id);
  if (s.length <= 3) return "***";
  return s.slice(0, s.length - 3) + "***";
}

// ✅ 날짜 KR (YYYY-MM-DD)
function formatDateKR(s) {
  if (!s) return "-";
  const t = String(s).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

async function apiFetch(url, opt = {}) {
  const r = await fetch(url, { credentials: "include", ...opt });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `요청 실패 (${r.status})`);
  return data;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

/* =========================
   ✅ 복사 유틸 (안전 버전)
========================= */
function copyText(text) {
  const el = document.createElement("input");
  el.type = "text";
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  el.style.top = "0";
  document.body.appendChild(el);

  el.focus();
  el.select();
  el.setSelectionRange(0, el.value.length); // ✅ 모바일/사파리 대비

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (_) {
    ok = false;
  }

  document.body.removeChild(el);

  if (!ok) {
    alert("복사 실패(직접 드래그해서 복사해주세요)");
    return false;
  }
  alert("복사 완료");
  return true;
}

/* =========================
   ✅ 로그인/회원가입
========================= */
window.NAVI.bindLogin = function () {
  const form = $("#loginForm");
  const msg = $("#msg");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";

    const login_id = (form.login_id?.value || "").trim();
    const password = form.password?.value || "";

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ login_id, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (msg) msg.textContent = data.message || "로그인 실패";
        return;
      }

      location.href = "/records";
    } catch (err) {
      console.error(err);
      if (msg) msg.textContent = "서버/네트워크 오류";
    }
  });
};

window.NAVI.bindRegister = function () {
  const form = $("#registerForm");
  const msg = $("#msg");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";

    const login_id = form.login_id.value.trim();
    const password = form.password.value;
    const password_confirm = form.password_confirm.value;
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const email = form.email.value.trim();

    if (password.length < 8) {
      if (msg) msg.textContent = "비밀번호는 8자 이상 입력 해주세요.";
      return;
    }
    if (password !== password_confirm) {
      if (msg) msg.textContent = "비밀번호가 서로 다릅니다.";
      return;
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ login_id, password, name, phone, email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (msg) msg.textContent = data.message || "가입 실패";
        return;
      }

      location.href = "/login";
    } catch (err) {
      console.error(err);
      if (msg) msg.textContent = "서버/네트워크 오류";
    }
  });
};

/* =========================
   ✅ 아이디 찾기
========================= */
async function onFindId() {
  const name = $("#findIdName")?.value?.trim();
  const email = $("#findIdEmail")?.value?.trim();
  const out = $("#findIdResult");
  if (!out) return;

  out.className = "result-msg";   // ✅ error 고정하지 말고
  out.textContent = "";

  try {
    const r = await apiFetch("/api/find-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    if (!r.results?.length) {
      out.className = "result-msg error";
      out.textContent = "일치하는 계정을 찾지 못했습니다.";
      return;
    }

    out.className = "result-msg ok";
    out.innerHTML = `
      <div class="mb-2 fw-semibold result-title">검색 결과 (로그인 ID)</div>
      <ul class="list-group result-list">
        ${r.results.map(x => `
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <span class="fw-semibold">${escapeHtml(maskLoginId(x.login_id))}</span>
            <span class="badge text-bg-light">가입 ${escapeHtml(formatDateKR(x.joined_at))}</span>
          </li>
        `).join("")}
      </ul>
    `;
  } catch (e) {
    out.className = "result-msg error";
    out.textContent = e.message || "실패";
  }
}

/* =========================
   ✅ 비밀번호 찾기 (임시비번 발급)
========================= */
async function onResetPw() {
  const login_id = $("#resetLoginId")?.value?.trim();
  const name = $("#resetName")?.value?.trim();
  const email = $("#resetEmail")?.value?.trim();
  const out = $("#resetPwResult");
  if (!out) return;

  out.innerHTML = "";

  try {
    const r = await apiFetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id, name, email }),
    });

    const temp = r?.temp_password || "";

    out.innerHTML = `
      <div class="temp-card">
        <div class="temp-title">임시 비밀번호</div>

        <div class="temp-row">
          <div class="temp-pw font-monospace">${escapeHtml(temp)}</div>
          <button type="button" class="btn-copy" id="btnCopyTempPw">복사</button>
        </div>

        <div class="temp-hint">로그인 후 비밀번호를 꼭 변경하세요.</div>
      </div>
    `;

    // ✅ 클릭 시 복사
   const btn = out.querySelector("#btnCopyTempPw");
    btn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyText(temp);
    });

    // ✅ 로그인 폼 자동 입력
    const loginInput = document.querySelector('[name="login_id"]');
    const pwInput = document.querySelector('[name="password"]');
    if (loginInput && pwInput) {
      loginInput.value = login_id || "";
      pwInput.value = temp;
    }

    // (원하면) ✅ 임시비번 발급 후 마이페이지로 이동하려면:
    // location.href = "/mypage";

  } catch (e) {
    out.innerHTML = `<div class="result-msg error">${escapeHtml(e.message || "실패")}</div>`;
  }
}

/* =========================
   ✅ 이벤트 바인딩
========================= */
document.addEventListener("DOMContentLoaded", () => {
  // login/register 페이지에서만 존재하므로 있어도 문제 없음
  window.NAVI.bindLogin();
  window.NAVI.bindRegister();

  // 모달 버튼 클릭
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btnFindId")) onFindId();
    if (e.target.closest("#btnResetPw")) onResetPw();
  });
});
