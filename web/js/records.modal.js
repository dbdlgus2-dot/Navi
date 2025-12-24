// web/js/records.modal.js
import { $, num, toYMD } from "./util.js";

let lastInputDate = "";

function getModal() {
  const el = $("#editModal");
  if (!el) return null;
  return bootstrap.Modal.getOrCreateInstance(el);
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

  // 수정일 때 날짜 변경 불가
  if (mode === "edit") f.date.setAttribute("disabled", "disabled");
  else f.date.removeAttribute("disabled");

  f.name.value = row.name ?? "";
  f.phone.value = row.phone ?? "";
  f.pay_card.value = row.pay_card ? String(row.pay_card) : "";
  f.pay_cash.value = row.pay_cash ? String(row.pay_cash) : "";
  f.pay_bank.value = row.pay_bank ? String(row.pay_bank) : "";
  f.product.value = row.product ?? "";
  f.car.value = row.car ?? "";
  f.customer_type.value = row.customer_type ?? "수리";
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

  const payload = {
    id,
    date: rawDate,
    name: (f.name.value || "").trim(),
    phone: (f.phone.value || "").trim(),
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

  if (!payload.name) throw new Error("성명은 필수야");
  return payload;
}