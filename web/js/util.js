// web/js/util.js
export const $ = (sel, root = document) => root.querySelector(sel);

export const fmt = (n) => Number(n || 0).toLocaleString("ko-KR");

export const num = (v) => {
  const x = String(v ?? "").replace(/[^\d]/g, "");
  return x ? Number(x) : 0;
};

export function toYMD(v) {
  if (!v) return "";

  // 이미 YYYY-MM-DD면 그대로
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // ✅ 연도 없는 영문 날짜(Thu Dec 04) 같은 형태면 파싱 금지
  if (typeof v === "string" && /^[A-Za-z]{3}\s[A-Za-z]{3}\s\d{2}$/.test(v.trim())) {
    return "";
  }
  const dt = (v instanceof Date) ? v : new Date(v);
  if (isNaN(dt)) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthAgo(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - 1);
  return d;
}

export function initDefaultDates(force = true) {
  const fromEl = $("#dateFrom");
  const toEl = $("#dateTo");
  if (!fromEl || !toEl) return;

  const today = new Date();
  const from = monthAgo(today);

  if (force || !fromEl.value) fromEl.value = toYMD(from);
  if (force || !toEl.value) toEl.value = toYMD(today);
}

export function normalizeRow(r = {}) {
  return {
    // =====================
    // 기본 식별 / 날짜
    // =====================
    id: Number(r.id),
    date: toYMD(r.date || r.repair_date || ""),

    // =====================
    // 고객 정보
    // =====================
    name: r.name || r.customer_name || "",
    phone: r.phone || r.customer_phone || "",
    memo: r.memo || r.card_company || "",

    // =====================
    // 결제
    // =====================
    pay_card: Number(r.pay_card ?? r.card_amount ?? 0),
    pay_cash: Number(r.pay_cash ?? r.cash_amount ?? 0),
    pay_bank: Number(r.pay_bank ?? r.bank_amount ?? 0),
    installment_mon: Number(r.installment_mon ?? 0),

    // =====================
    // 제품 / 수리
    // =====================
    product: r.product || r.product_name || "",
    car: r.car || r.car_name || "",
    desc: r.desc || r.repair_detail || "",

    // =====================
    // 상태
    // =====================
    safe_member: r.safe_member === true || r.safe_member === "t",
    free_repair: r.free_repair === true || r.free_repair === "t",

    status:
      r.status ||
      (r.free_repair
        ? "무상"
        : r.safe_member
        ? "안심회원"
        : "일반"),

    // =====================
    // 🔥 수리안내 핵심 필드 (절대 삭제하면 안 됨)
    // =====================
    guide_date: r.guide_date || "",
    guide_done: r.guide_done === true || r.guide_done === "t",
    guide_due: r.guide_due === true || r.guide_due === "t",
    guide_done_at: r.guide_done_at || null,

    card_company: r.card_company || r.memo || r.card_company || "",
    installment_mon: Number(r.installment_mon ?? 0),
  };
}