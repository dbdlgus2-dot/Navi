// web/js/records.modal.js
import { $, num, toYMD } from "./util.js";
import "./common.bind.js";

let lastInputDate = "";

function getModal() {
  const el = $("#editModal");
  if (!el) return null;
  return bootstrap.Modal.getOrCreateInstance(el);
}

// ✅ 모달에서도 서버 정책과 동일하게 통일
function normalizePhoneKR(input) {
  if (!input) return "";
  const digits = String(input).replace(/\D/g, "");
  if (!/^01[016789]\d{8}$/.test(digits)) return "";
  return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
}

export function setModal(mode, row = {}) {
  const f = $("#editForm");
  if (!f) return;

  $("#modalTitle").textContent = mode === "new" ? "새로 입력" : "수정";

  const idEl = f.querySelector('[name="id"]');
  idEl.value = mode === "new" ? "" : String(row.id ?? "");

  const baseDate =
    mode === "new" ? (lastInputDate || toYMD(new Date())) : toYMD(row.date);

  f.date.value = baseDate;

  if (mode === "edit") f.date.setAttribute("disabled", "disabled");
  else f.date.removeAttribute("disabled");

  f.name.value = row.name ?? "";
  f.phone.value = row.phone ?? "";

  f.pay_card.value = row.pay_card ? String(row.pay_card) : "";
  f.pay_cash.value = row.pay_cash ? String(row.pay_cash) : "";
  f.pay_bank.value = row.pay_bank ? String(row.pay_bank) : "";
  f.product.value = row.product ?? "";
  f.car.value = row.car ?? "";

  // ✅ new 기본값 "신규"
  f.customer_type.value = row.customer_type ?? (mode === "new" ? "신규" : "수리");

  f.desc.value = row.desc ?? "";

  if (f.card_company) f.card_company.value = row.card_company ?? "";
  if (f.installment_mon) f.installment_mon.value = row.installment_mon ?? 0;

  getModal()?.show();
}

export function hideModal() {
  getModal()?.hide();
}

export function setLastInputDate(v) {
  lastInputDate = v || "";
}

export function getPayloadFromModal() {
  const f = $("#editForm");
  const idInput = f.querySelector('[name="id"]');
  const id = idInput?.value ? Number(idInput.value) : null;

  const rawDate = (f.date.value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    throw new Error(`날짜 형식이 이상함: ${rawDate} (YYYY-MM-DD 여야 함)`);
  }

  const rawPhone = (f.phone.value || "").trim();
  const normPhone = rawPhone ? normalizePhoneKR(rawPhone) : "";

  if (rawPhone && !normPhone) {
    throw new Error("휴대폰 번호 형식이 올바르지 않습니다. (예: 010-1234-5678)");
  }

  const payload = {
    id,
    date: rawDate,
    name: (f.name.value || "").trim(),
    phone: normPhone,
    pay_card: num(f.pay_card.value),
    pay_cash: num(f.pay_cash.value),
    pay_bank: num(f.pay_bank.value),
    product: (f.product.value || "").trim(),
    car: (f.car.value || "").trim(),
    customer_type: f.customer_type.value,
    desc: (f.desc.value || "").trim(),
    card_company: (f.card_company?.value || "").trim(),
    installment_mon: num(f.installment_mon?.value),
  };

  if (!payload.name) throw new Error("성명은 필수입니다.");
  return payload;
}