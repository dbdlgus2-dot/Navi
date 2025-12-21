// web/js/records.js
import { $, num, toYMD, initDefaultDates, normalizeRow } from "./util.js";
import { api } from "./api.js";
import { renderRows, renderSums } from "./ui.js";

let rows = [];
let lastInputDate = ""; // 새로 입력시 마지막 입력 날짜 유지

function buildQueryString() {
  const qs = new URLSearchParams();

  const from = $("#dateFrom")?.value || "";
  const to = $("#dateTo")?.value || "";
  const q = ($("#q")?.value || "").trim();

  const safe = $("#only安心")?.checked ? "1" : "";
  const free = $("#onlyFree")?.checked ? "1" : "";

  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (q) qs.set("q", q);
  if (safe) qs.set("safe", safe);
  if (free) qs.set("free", free);

  return qs.toString();
}

async function load() {
  const data = await api.list(buildQueryString());
  rows = Array.isArray(data) ? data.map(normalizeRow) : [];
  renderRows(rows);
  renderSums(rows);
}

function getModal() {
  const el = $("#editModal");
  if (!el) return null;
  return bootstrap.Modal.getOrCreateInstance(el);
}

function setModal(mode, row = {}) {
  const f = $("#editForm");
  if (!f) return;

  $("#modalTitle").textContent = mode === "new" ? "새로 입력" : "수정";

  const idEl = f.querySelector('[name="id"]');
  idEl.value = mode === "new" ? "" : String(row.id ?? "");

  // 날짜: 새로입력은 마지막 입력 날짜 우선, 없으면 오늘
  const baseDate = mode === "new"
    ? (lastInputDate || toYMD(new Date()))
    : toYMD(row.date);

  f.date.value = baseDate;
  f.name.value = row.name ?? "";
  f.phone.value = row.phone ?? "";
  f.pay_card.value = row.pay_card ? String(row.pay_card) : "";
  f.pay_cash.value = row.pay_cash ? String(row.pay_cash) : "";
  f.pay_bank.value = row.pay_bank ? String(row.pay_bank) : "";
  f.product.value = row.product ?? "";
  f.car.value = row.car ?? "";
  f.status.value = row.status ?? "일반";
  f.desc.value = row.desc ?? "";

  getModal()?.show();
}

function getPayloadFromModal() {
  const f = $("#editForm");
  const idInput = f.querySelector('[name="id"]');
  const id = idInput?.value ? Number(idInput.value) : null;

  // ✅ 핵심: input[type=date] 값은 항상 YYYY-MM-DD여야 함
  const rawDate = (f.date.value || "").trim();

  // YYYY-MM-DD 아니면 저장 막기
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
    status: f.status.value,
    desc: (f.desc.value || "").trim(),

    memo: "현대카드",
    installment_mon: 0,
  };

  if (!payload.name) throw new Error("성명은 필수야");
  return payload;
}

function bindEvents() {
  $("#btnSearch")?.addEventListener("click", () => load());
  $("#dateFrom")?.addEventListener("change", () => load());
  $("#dateTo")?.addEventListener("change", () => load());
  $("#only安心")?.addEventListener("change", () => load());
  $("#onlyFree")?.addEventListener("change", () => load());

  $("#q")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      load();
    }
  });

  $("#btnNew")?.addEventListener("click", () => setModal("new"));

  $("#btnSave")?.addEventListener("click", async () => {
    try {
      const payload = getPayloadFromModal();

      // ✅ 수정이면 PUT, 새로면 POST
      if (payload.id) {
        await api.update(payload);
      } else {
        await api.create(payload);
      }

      lastInputDate = payload.date; // 다음 새로입력 기본 날짜로 유지
      getModal()?.hide();
      await load();
    } catch (e) {
      console.error(e);
      alert(e.message || "저장 실패");
    }
  });

  $("#tbody")?.addEventListener("click", async (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;

    const id = Number(tr.dataset.id);
    const row = rows.find((r) => r.id === id);

    if (e.target.closest(".btn-edit")) {
      setModal("edit", row);
      return;
    }

    if (e.target.closest(".btn-del")) {
      if (!confirm("삭제할까?")) return;
      try {
        await api.remove(id);
        await load();
      } catch (err) {
        console.error(err);
        alert(err.message || "삭제 실패");
      }
    }
  });
}

function init() {
  // ✅ 기본 날짜: 시작=한달전, 끝=오늘
  initDefaultDates(true);

  bindEvents();
  load().catch((e) => {
    console.error(e);
    alert(e.message || "불러오기 실패");
  });
}

document.addEventListener("DOMContentLoaded", init);