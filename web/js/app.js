window.NAVI = window.NAVI || {};

// ❗ 여기서만 선언
const $ = (sel) => document.querySelector(sel);

// ✅ 아이디 찾기 마스킹처리
function maskLoginId(id) {
  if (!id) return "";
  const s = String(id);
  if (s.length <= 3) return "***";
  return s.slice(0, s.length - 3) + "***";
}

// ✅ 날짜 데이터 
function formatDateKR(s) {
  if (!s) return "-";
  // "2025-12-21" 같은 값이면 그대로 쓰고, timestamp면 앞 10자리로 자르기
  const t = String(s).slice(0, 10);
  // YYYY-MM-DD 형태면 OK
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  // 그 외는 Date로 파싱 시도
  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

window.NAVI.bindLogin = function () {
  const form = $("#loginForm");
  const msg = $("#msg");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    // ✅ 여기 수정
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
        msg.textContent = data.message || "로그인 실패";
        return;
      }

      location.href = "/records";
    } catch (err) {
      console.error(err);
      msg.textContent = "서버/네트워크 오류";
    }
  });
};

window.NAVI.bindRegister = function () {
  const form = $("#registerForm");
  const msg = $("#msg");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const login_id = form.login_id.value.trim();
    const password = form.password.value;
    const password_confirm = form.password_confirm.value;
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const email = form.email.value.trim();

    if (password.length < 8) {
      msg.textContent = "비밀번호는 8자 이상 입력 해주세요.";
      return;
    }
    if (password !== password_confirm) {
      msg.textContent = "비밀번호가 서로 다릅니다.";
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
        msg.textContent = data.message || "가입 실패";
        return;
      }

      location.href = "/login";
    } catch (err) {
      console.error(err);
      msg.textContent = "서버/네트워크 오류";
    }
  });
};

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


// ✅ 아이디 찾기
async function onFindId() {
  const name = document.querySelector("#findIdName")?.value?.trim();
  const email = document.querySelector("#findIdEmail")?.value?.trim();
  const out = document.querySelector("#findIdResult");

  out.className = "result-msg error";
  out.textContent = "";

  try {
    const r = await apiFetch("/api/find-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    if (!r.results?.length) {
      out.textContent = "일치하는 계정을 찾지 못했습니다.";
      return;
    }

    out.className = "small";
    out.innerHTML = `
      <div class="mb-2 fw-semibold" style="color:#e5f6ff">검색 결과 (로그인 ID)</div>
      <ul class="list-group">
        ${r.results.map(x => `
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <span class="fw-semibold">
              ${escapeHtml(maskLoginId(x.login_id))}
            </span>
            <span class="badge text-bg-light">
              가입 ${escapeHtml(x.joined_at || "-")}
            </span>
          </li>
        `).join("")}
  </ul>
`;
  } catch (e) {
    out.className = "small text-danger";
    out.textContent = e.message || "실패";
  }
}

async function onResetPw() {
  const login_id = document.querySelector("#resetLoginId")?.value?.trim();
  const name = document.querySelector("#resetName")?.value?.trim();
  const email = document.querySelector("#resetEmail")?.value?.trim();
  const out = document.querySelector("#resetPwResult");

  out.innerHTML = "";

  try {
    const r = await apiFetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id, name, email }),
    });

    const temp = r.temp_password || "";
    out.innerHTML = `
      <div class="alert alert-warning d-flex justify-content-between align-items-center gap-2">
        <div>
          <div class="fw-semibold">임시 비밀번호</div>
          <div class="font-monospace">${escapeHtml(temp)}</div>
        <button class="btn-copy " id="btnCopyTempPw">복사</button>
        <br/
       <div class="pw-hint">로그인 후 비밀번호를 꼭 변경하세요.</div>
      </div>
    `;

    document.querySelector("#btnCopyTempPw")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(temp);
        alert("복사 완료");
      } catch (_) {
        // clipboard 막히면 fallback
        const ta = document.createElement("textarea");
        ta.value = temp;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        alert("복사 완료");
      }
    });

    // 편의: 로그인 폼에 자동 입력(원하면 제거)
    const loginInput = document.querySelector('[name="login_id"]');
    const pwInput = document.querySelector('[name="password"]');
    if (loginInput && pwInput) {
      loginInput.value = login_id || "";
      pwInput.value = temp;
    }
  } catch (e) {
    out.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(e.message || "실패")}</div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btnFindId")) onFindId();
    if (e.target.closest("#btnResetPw")) onResetPw();
  });
});