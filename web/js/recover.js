"use strict";
import { $ } from "./util.js";

async function apiFetch(url, opt = {}) {
  const r = await fetch(url, { credentials: "include", ...opt });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `요청 실패 (${r.status})`);
  return data;
}

$("#btnFindId")?.addEventListener("click", async () => {
  try {
    const name = $("#findName").value.trim();
    const phone = $("#findPhone").value.trim();
    const r = await apiFetch("/api/recover/login-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });

    $("#findIdResult").textContent =
      r.login_id_masked ? `아이디(마스킹): ${r.login_id_masked}` : "일치하는 정보가 없거나 확인할 수 없습니다.";
  } catch (e) {
    alert(e.message);
  }
});

$("#btnReqToken")?.addEventListener("click", async () => {
  try {
    const login_id = $("#pwLoginId").value.trim();
    const name = $("#pwName").value.trim();
    const phone = $("#pwPhone").value.trim();

    const r = await apiFetch("/api/recover/password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id, name, phone }),
    });

    // 개발모드면 토큰이 내려옴
    $("#tokenHint").textContent = r.dev_token ? `(개발용 코드: ${r.dev_token}, ${r.expires_minutes}분)` : "인증코드를 발송했습니다.";
  } catch (e) {
    alert(e.message);
  }
});

$("#btnResetPw")?.addEventListener("click", async () => {
  try {
    const login_id = $("#pwLoginId").value.trim();
    const token = $("#pwToken").value.trim();
    const new_password = $("#pwNew").value;
    const new_password2 = $("#pwNew2").value;

    if (new_password.length < 8) return alert("비밀번호는 8자 이상");
    if (new_password !== new_password2) return alert("새 비밀번호 확인이 다릅니다.");

    await apiFetch("/api/recover/password/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id, token, new_password }),
    });

    alert("비밀번호 변경 완료! 로그인해줘.");
    location.href = "/login";
  } catch (e) {
    alert(e.message);
  }
});