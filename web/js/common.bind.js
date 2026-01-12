(() => {
  /**
   * 1. 로그인 ID 및 특정 필드 한글 차단 + 대문자 변환
   */
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;

    // 적용 대상: login_id 명칭이 포함되거나 data-upper="1"인 경우
    const isLoginId =
      el.name === "login_id" ||
      el.id === "login_id" ||
      el.id === "resetLoginId" ||
      el.id === "adminLoginId" || // 관리자 페이지용 추가
      el.dataset.upper === "1";

    if (!isLoginId) return;

    let v = el.value;

    // ❌ 한글 및 영문/숫자 외 모든 문자 즉시 제거
    v = v.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, "");
    v = v.replace(/[^a-zA-Z0-9]/g, "");

    // ✅ 무조건 대문자
    v = v.toUpperCase();

    if (el.value !== v) {
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
  // web/js/common.bind.js 내 checkImpersonated 함수 수정

async function checkImpersonated() {
    // ✅ 추가: 로그인 페이지나 메인 화면(/)에서는 바를 띄우지 않음
    const path = window.location.pathname;
    if (path === "/" || path === "/login.html") return;

    try {
        const r = await fetch("/api/me", { credentials: "include" });
        const me = await r.json();

        if (me && me.isImpersonated) {
            if (document.getElementById("impersonateBar")) return;

            const bar = document.createElement("div");
            bar.id = "impersonateBar";
            bar.style = "background: #ffc107; color: #000; text-align: center; padding: 12px; font-weight: bold; position: fixed; top: 0; left: 0; width: 100%; z-index: 10000;";
            bar.innerHTML = `
                현재 [${me.name}] 계정으로 대리 로그인 중입니다.
                <button id="btnExitImp" style="margin-left: 20px; padding: 4px 12px; cursor: pointer; border-radius: 4px; background: #fff; border: 1px solid #000;">관리자로 복귀</button>
            `;
            document.body.prepend(bar);
            document.body.style.paddingTop = "50px";

            document.getElementById("btnExitImp").onclick = async () => {
                // ✅ POST 요청 주소가 서버 라우터 설정과 일치하는지 확인
                const res = await fetch("/api/admin/exit-impersonate", { method: "POST" });
                const data = await res.json();
                if (data.success) {
                    alert("관리자 계정으로 복귀합니다.");
                    location.href = data.redirectUrl; // /admin 으로 이동
                }
            };
        }
    } catch (e) {
        console.log("비로그인 또는 일반 사용자");
    }
}

  // 페이지 로드 시 복귀 바 체크 실행
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkImpersonated);
  } else {
    checkImpersonated();
  }
})();