(() => {
  /**
   * 0. 입력 에러 메시지 표시 함수
   */
  function showInputError(el, message) {
    // 이미 메시지가 떠 있다면 중복 생성 방지
    let errorEl = el.parentElement.querySelector(".input-error-msg");
    if (!errorEl) {
      errorEl = document.createElement("div");
      errorEl.className = "input-error-msg";
      errorEl.style = "color: #ff4d4d; font-size: 12px; margin-top: 4px; font-weight: bold; position: absolute;";
      el.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;

    // 2초 후 메시지 자동 삭제
    setTimeout(() => {
      if (errorEl) errorEl.textContent = "";
    }, 2000);
  }

  /**
   * 1. 로그인 ID 및 특정 필드 한글 차단 + 대문자 변환 + 안내 메시지
   */
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;

    const isLoginId =
      el.name === "login_id" ||
      el.id === "login_id" ||
      el.id === "resetLoginId" ||
      el.id === "adminLoginId" ||
      el.dataset.upper === "1";

    if (!isLoginId) return;

    let v = el.value;
    let originalValue = v;

    // ❌ 한글 확인 및 제거
    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(v)) {
      v = v.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, "");
      showInputError(el, "⚠️ 한글은 입력할 수 없습니다.");
    }

    // ❌ 영문/숫자 외 모든 특수문자 제거
    if (/[^a-zA-Z0-9]/.test(v)) {
      v = v.replace(/[^a-zA-Z0-9]/g, "");
      // 한글 에러 메시지가 없을 때만 특수문자 에러 표시
      const currentMsg = el.parentElement.querySelector(".input-error-msg")?.textContent;
      if (!currentMsg) showInputError(el, "⚠️ 영문과 숫자만 가능합니다.");
    }

    // ✅ 대문자 변환
    v = v.toUpperCase();

    if (originalValue !== v) {
      const pos = el.selectionStart ?? v.length;
      el.value = v;
      try { el.setSelectionRange(pos, pos); } catch (_) {}
    }
  });

  /**
   * 2. 전화번호 자동 하이픈 로직
   */
  function formatPhoneKR(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return digits.replace(/(\d{3})(\d+)/, "$1-$2");
    return digits.replace(/(\d{3})(\d{4})(\d+)/, "$1-$2-$3");
  }

  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    const isPhone = el.name === "phone" || el.id === "mePhone" || el.dataset.phone === "1" || el.id === "adminPhone";
    if (isPhone) el.value = formatPhoneKR(el.value);
  });

  /**
   * 3. 관리자 대리 로그인 복귀 바 (노란색)
   */
  async function checkImpersonated() {
    const path = window.location.pathname;
    if (path === "/" || path === "/login.html") return;

    try {
      const r = await fetch("/api/me", { credentials: "include" });
      const me = await r.json();

      if (me && me.isImpersonated) {
        if (document.getElementById("impersonateBar")) return;

        const bar = document.createElement("div");
        bar.id = "impersonateBar";
        bar.style = "background: #ffc107; color: #000; text-align: center; padding: 12px; font-weight: bold; position: fixed; top: 0; left: 0; width: 100%; z-index: 10000; box-shadow: 0 2px 5px rgba(0,0,0,0.1);";
        bar.innerHTML = `
            현재 [${me.name}] 계정으로 대리 로그인 중입니다.
            <button id="btnExitImp" style="margin-left: 20px; padding: 4px 12px; cursor: pointer; border-radius: 4px; background: #fff; border: 1px solid #000; font-weight: bold;">관리자로 복귀</button>
        `;
        document.body.prepend(bar);
        document.body.style.paddingTop = "50px";

        document.getElementById("btnExitImp").onclick = async () => {
          const res = await fetch("/api/admin/exit-impersonate", { method: "POST" });
          const data = await res.json();
          if (data.success) {
            alert("관리자 계정으로 복귀합니다.");
            location.href = data.redirectUrl; 
          }
        };
      }
    } catch (e) {
      console.log("비로그인 또는 일반 사용자");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkImpersonated);
  } else {
    checkImpersonated();
  }
})();