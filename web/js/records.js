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
  const guide80 = $("#onlyGuide80")?.checked ? "1" : "";

  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (q) qs.set("q", q);
  if (safe) qs.set("safe", safe);
  if (free) qs.set("free", free);
  if (guide80) qs.set("guide80", guide80);

  return qs.toString();
}

// ✅ 서버에서 내려온 값들 bool처럼 쓰기
function asBool(v) {
  return v === true || v === 1 || v === "1" || v === "t" || v === "true";
}

async function load() {
  const qs = buildQueryString(); // ✅ 한 번만 만들기
  const data = await api.list(qs);

  rows = Array.isArray(data) ? data.map(normalizeRow) : [];

  // ✅ 디버그용(콘솔에서 window.__rows 로 확인)
  window.__rows = rows;
  window.__lastQs = qs;

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

  const baseDate =
    mode === "new" ? (lastInputDate || toYMD(new Date())) : toYMD(row.date);

  f.date.value = baseDate;

  // ✅ 핵심: 수정일 때 날짜 변경 불가
  if (mode === "edit") {
    f.date.setAttribute("disabled", "disabled");
  } else {
    f.date.removeAttribute("disabled");
  }

  f.name.value = row.name ?? "";
  f.phone.value = row.phone ?? "";
  f.pay_card.value = row.pay_card ? String(row.pay_card) : "";
  f.pay_cash.value = row.pay_cash ? String(row.pay_cash) : "";
  f.pay_bank.value = row.pay_bank ? String(row.pay_bank) : "";
  f.product.value = row.product ?? "";
  f.car.value = row.car ?? "";
  f.status.value = row.status ?? "일반";
  f.desc.value = row.desc ?? "";

  // 카드사 / 할부
  if (f.card_company) {
    f.card_company.value = row.card_company ?? "";
  }
  if (f.installment_mon) {
    f.installment_mon.value = row.installment_mon ?? 0;
  }

  getModal()?.show();
}

function getPayloadFromModal() {
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
    status: f.status.value,
    desc: (f.desc.value || "").trim(),
    // ✅ 카드사/할부개월수
    card_company: (f.card_company?.value || "").trim(),
    installment_mon: num(f.installment_mon?.value),
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
  $("#onlyGuide80")?.addEventListener("change", () => load());

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

      if (payload.id) await api.update(payload);
      else await api.create(payload);

      lastInputDate = payload.date;
      getModal()?.hide();
      await load();
    } catch (e) {
      console.error(e);
      alert(e.message || "저장 실패");
    }
  });

  // ✅ 테이블 버튼들(수정/삭제/수리안내)
  $("#tbody")?.addEventListener("click", async (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;

    const id = Number(tr.dataset.id);
    const row = rows.find((r) => r.id === id);
    if (!row) return;

    // ✅ 수리안내 버튼
    if (e.target.closest(".btn-guide")) {
      // ✅ 정책: 안심회원만 수리안내 가능
      const isSafe = (row.status === "안심회원") || asBool(row.safe_member);
      if (!isSafe) return;

      // ✅ 90일 도래(due=true)인 사람만 활성
      const due = asBool(row.guide_due);
      if (!due) {
        alert("아직 수리안내 기간이 아닙니다. (90일 이후 활성)");
        return;
      }

      // ✅ done이어도 due면 “재안내” 가능
      const isDone = asBool(row.guide_done);
      const label = isDone ? "재안내 처리(안내일 갱신)" : "수리안내 처리(안내완료)";

      if (!confirm(`${label} 할까?`)) return;

      try {
        await api.guideDone(id); // ✅ api.js의 guideDone 사용
        await load();
      } catch (err) {
        console.error(err);
        alert(err.message || "수리안내 처리 실패");
      }
      return;
    }

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
  initDefaultDates(true);
  bindEvents();
  load().catch((e) => {
    console.error(e);
    alert(e.message || "불러오기 실패");
  });
}

document.addEventListener("DOMContentLoaded", init);