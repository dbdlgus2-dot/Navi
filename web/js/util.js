// web/js/util.js
export const $ = (sel, root = document) => root.querySelector(sel);

export const fmt = (n) => Number(n || 0).toLocaleString("ko-KR");

export const num = (v) => {
  const x = String(v ?? "").replace(/[^\d]/g, "");
  return x ? Number(x) : 0;
};

export function toYMD(v) {
  if (!v) return "";
  const s = String(v);
  if (s.includes("T")) return s.slice(0, 10);                // 2025-12-04T... -> 2025-12-04
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;               // already YMD
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;                   // 못 파싱하면 원문
  return d.toISOString().slice(0, 10);
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

export function normalizeRow(r) {
  return {
    id: Number(r.id),
    date: toYMD(r.date || r.repair_date || ""),
    name: r.name || r.customer_name || "",
    phone: r.phone || r.customer_phone || "",
    memo: r.memo || r.card_company || "",
    pay_card: Number(r.pay_card ?? r.card_amount ?? 0),
    pay_cash: Number(r.pay_cash ?? r.cash_amount ?? 0),
    pay_bank: Number(r.pay_bank ?? r.bank_amount ?? 0),
    product: r.product || r.product_name || "",
    car: r.car || r.car_name || "",
    desc: r.desc || r.repair_detail || "",
    status: r.status || (r.free_repair ? "무상" : r.safe_member ? "안심회원" : "일반"),
  };
}