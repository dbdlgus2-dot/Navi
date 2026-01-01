"use strict";
import { $ } from "./util.js";
import "./common.bind.js"; // ✅ 공통 바인딩(대문자/폰 하이픈 등)

function normalizePhoneKR(input) {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (!/^01[016789]\d{8}$/.test(digits)) return null; // 11자리만
  return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
}

async function apiFetch(url, opt = {}) {
  const r = await fetch(url, { credentials: "include", ...opt });
  let data = {};
  try { data = await r.json(); } catch (_) {}

  if (r.status === 401) {
    alert("로그인이 필요합니다.");
    location.href = "/";
    return null;
  }
  if (!r.ok) throw new Error(data.message || `요청 실패 (${r.status})`);
  return data;
}

function fmtYMD(s) {
  return s ? String(s).slice(0, 10) : "-";
}

async function loadMe() {
  const me = await apiFetch("/api/me/detail");
  if (!me) return;

  $("#meLoginMeta").textContent = `로그인ID: ${me.login_id} / 권한: ${me.role}`;

  $("#meName").value = me.name || "";
  $("#mePhone").value = me.phone || "";
  $("#meEmail").value = me.email || "";

  $("#meJoinedAt").textContent = fmtYMD(me.joined_at);
  $("#mePaidUntil").textContent = fmtYMD(me.paid_until);

  const badge = $("#meActiveBadge");
  const expired = me.expired === true;
  const active = !!me.is_active;

  if (expired) {
    badge.className = "badge text-bg-danger";
    badge.textContent = "만료";
  } else if (!active) {
    badge.className = "badge text-bg-warning";
    badge.textContent = "비활성";
  } else {
    badge.className = "badge text-bg-success";
    badge.textContent = "활성";
  }
}

async function saveProfile() {
  const name = ($("#meName").value || "").trim();
  const rawPhone = ($("#mePhone").value || "").trim();
  const email = ($("#meEmail").value || "").trim() || null;

  if (!name) { alert("이름은 필수입니다."); $("#meName").focus(); return; }

  let phone = null;
  if (rawPhone) {
    const norm = normalizePhoneKR(rawPhone);
    if (!norm) { alert("휴대폰 번호 형식이 올바르지 않습니다. (예: 010-1234-5678)"); $("#mePhone").focus(); return; }
    phone = norm;
    $("#mePhone").value = norm; // 화면도 통일
  }

  if (!confirm("저장할까요?")) return;

  await apiFetch("/api/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone, email }),
  });

  alert("저장 완료");
  await loadMe();
}

async function changePassword() {
  const cur = $("#curPw")?.value || "";
  const nw  = $("#newPw")?.value || "";
  const nw2 = $("#newPw2")?.value || "";

  if (!cur || !nw) throw new Error("현재/새 비밀번호를 입력해주세요.");

  const pwRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,20}$/;
  if (!pwRegex.test(nw)) {
    throw new Error("비밀번호는 8~20자이며 영문 대/소문자, 숫자, 특수문자를 모두 포함해야 합니다.");
  }
  if (nw !== nw2) throw new Error("새 비밀번호 확인이 일치하지 않습니다.");

  await apiFetch("/api/me/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: cur, new_password: nw }),
  });

  $("#curPw").value = "";
  $("#newPw").value = "";
  $("#newPw2").value = "";
}

async function logout() {
  await apiFetch("/api/logout", { method: "POST" });
  location.href = "/";
}

/* ✅ 이게 없으면 화면은 무조건 비어있음 */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadMe();

    $("#btnSaveProfile")?.addEventListener("click", saveProfile);
    $("#btnLogout")?.addEventListener("click", logout);
    $("#btnMeReload")?.addEventListener("click", loadMe);

    $("#btnChangePw")?.addEventListener("click", async () => {
      try {
        await changePassword();
        alert("비밀번호 변경 완료");
      } catch (e) {
        console.error(e);
        alert(e.message || "비밀번호 변경 실패");
      }
    });
  } catch (e) {
    console.error("[mypage init error]", e);
    alert(e.message || "마이페이지 로딩 실패");
  }
});