"use strict";
import { $ } from "./util.js";

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

  // ✅ id 맞춤
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
  const payload = {
  phone: ($("#mePhone").value || "").trim() || null,
  email: ($("#meEmail").value || "").trim() || null,
};
  await apiFetch("/api/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  alert("저장 완료");
  await loadMe();
}

async function changePassword() {
  const cur = $("#curPw")?.value || "";
  const nw  = $("#newPw")?.value || "";
  const nw2 = $("#newPw2")?.value || "";

  if (!cur || !nw) throw new Error("현재/새 비밀번호를 입력해줘");
  if (nw.length < 8) throw new Error("새 비밀번호는 8자 이상");
  if (nw !== nw2) throw new Error("새 비밀번호 확인이 다름");

  await apiFetch("/api/me/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_password: cur,
      new_password: nw,
    }),
  });

  $("#curPw").value = "";
  $("#newPw").value = "";
  $("#newPw2").value = "";
}

async function logout() {
  await apiFetch("/api/logout", { method: "POST" });
  location.href = "/";
}

document.addEventListener("DOMContentLoaded", async () => {
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
});