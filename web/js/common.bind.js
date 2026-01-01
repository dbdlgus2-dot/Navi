// /js/common.bind.js
(() => {
  // ✅ login_id: 무조건 대문자 (id/name 둘 다 커버)
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;

    const isLogin =
      el.name === "login_id" ||
      el.id === "login_id" ||
      el.id === "resetLoginId" ||
      el.dataset.upper === "1";

    if (!isLogin) return;

    const v = el.value;
    const up = v.toUpperCase();
    if (v !== up) {
      const pos = el.selectionStart ?? up.length;
      el.value = up;
      try { el.setSelectionRange(pos, pos); } catch (_) {}
    }
  });

  // ✅ phone: 자동 하이픈 (name="phone" or id="mePhone" 등 커버)
  function formatPhoneKR(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return digits.replace(/(\d{3})(\d+)/, "$1-$2");
    return digits.replace(/(\d{3})(\d{4})(\d+)/, "$1-$2-$3");
  }

  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;

    const isPhone =
      el.name === "phone" ||
      el.id === "mePhone" ||
      el.dataset.phone === "1";

    if (!isPhone) return;

    const before = el.value;
    const pos = el.selectionStart ?? before.length;

    el.value = formatPhoneKR(before);

    const diff = el.value.length - before.length;
    try { el.setSelectionRange(pos + diff, pos + diff); } catch (_) {}
  });

  document.addEventListener("blur", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;

    const isPhone =
      el.name === "phone" ||
      el.id === "mePhone" ||
      el.dataset.phone === "1";

    if (!isPhone) return;

    el.value = formatPhoneKR(el.value);
  }, true);
})();