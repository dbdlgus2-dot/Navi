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

  // ✅ UI 체크박스 id도 맞춰서 바꿔야 함
  const safe    = $("#onlySafe")?.checked ? "1" : "";
  const revisit = $("#onlyRevisit")?.checked ? "1" : "";
  const isNew   = $("#onlyNew")?.checked ? "1" : "";
  const guide   = $("#onlyGuide")?.checked ? "1" : "";

  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (q) qs.set("q", q);

  if (safe) qs.set("safe", "1");
  if (revisit) qs.set("revisit", "1");
  if (isNew) qs.set("new", "1");
  if (guide) qs.set("guide", "1");

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
  f.date.disabled = (mode === "edit");


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
  f.customer_type.value = row.customer_type ?? "수리";
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
    customer_type: f.customer_type.value,
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
  $("#onlySafe")?.addEventListener("change", () => load());
  $("#onlyRevisit")?.addEventListener("change", () => load());
  $("#onlyGuide")?.addEventListener("change", () => load());
  $("#onlyNew")?.addEventListener("change", () => load());

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

        // ✅ 정책: customer_type이 안심회원일 때만
        // (normalizeRow에 customer_type 넣는 게 베스트)
        const isSafe = (row.customer_type === "안심회원");
        if (!isSafe) {
          alert("수리안내는 안심회원만 가능합니다.");
          return;
        }

        const due = asBool(row.guide_due);
        if (!due) {
          alert("아직 수리안내 기간이 아닙니다. (90일 이후 활성)");
          return;
        }

        if (!confirm("수리안내 처리(안내완료)로 변경할까?")) return;

        try {
          await api.guideDone(id);
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
      if (!confirm("삭제하시겠습니까")) return;
      try {
        await api.remove(id);
        await load();
      } catch (err) {
        console.error(err);
        alert(err.message || "삭제 실패");
      }
    }
  });

  // ✅ 엑셀 다운로드
  $("#btnExcel")?.addEventListener("click", () => {
    const rows = window.__rows || [];
    if (!rows.length) return alert("다운로드할 데이터가 없습니다.");
    if (typeof XLSX === "undefined") return alert("XLSX 라이브러리가 로드되지 않았습니다.");

    const data = rows.map((r, idx) => ({
      "No": rows.length - idx,
      "날짜": r.date || "",
      "성명": r.name || "",
      "전화번호": r.phone || "",
      "카드사(신용카드)": r.card_company || "",   // ✅ memo 말고 card_company
      "할부개월": Number(r.installment_mon || 0),
      "카드": Number(r.pay_card || 0),
      "현금": Number(r.pay_cash || 0),
      "입금": Number(r.pay_bank || 0),
      "제품": r.product || "",
      "차량": r.car || "",
      "수리내용": r.desc || "",
      "상태": r.customer_type || "",
      "수리안내일": r.guide_date || "",
      "안내상태": (r.guide_done ? "안내완료" : (r.guide_due ? "수리안내" : "대기중")),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    ws["!cols"] = [
      { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 16 },
      { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "현재조회");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Navi_수리내역_${today}.xlsx`);
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