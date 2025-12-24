// web/js/records.events.js
import { $ } from "./util.js";
import { api } from "./api.js";
import {
  setModal,
  hideModal,
  getPayloadFromModal,
  setLastInputDate,
} from "./records.modal.js";
import { load, asBool, getRows } from "./records.page.js";

function bindSearchEvents() {
  $("#btnSearch")?.addEventListener("click", load);
  $("#dateFrom")?.addEventListener("change", load);
  $("#dateTo")?.addEventListener("change", load);

  $("#onlySafe")?.addEventListener("change", load);
  $("#onlyRevisit")?.addEventListener("change", load);
  $("#onlyGuide")?.addEventListener("change", load);
  $("#onlyNew")?.addEventListener("change", load);

  $("#q")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      load();
    }
  });

  // ✅ 체크박스 하나만 선택(필요하면 유지)
  document.querySelectorAll(".filter-check").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (!cb.checked) return;
      document.querySelectorAll(".filter-check").forEach((other) => {
        if (other !== cb) other.checked = false;
      });
      load();
    });
  });
}

function bindModalEvents() {
  $("#btnNew")?.addEventListener("click", () => setModal("new"));

  $("#btnSave")?.addEventListener("click", async () => {
    try {
      const payload = getPayloadFromModal();

      if (payload.id) await api.update(payload);
      else await api.create(payload);

      setLastInputDate(payload.date);
      hideModal();
      await load();
    } catch (e) {
      console.error(e);
      alert(e.message || "저장 실패");
    }
  });
}

function bindTableEvents() {
  const tbody = $("#tbody");
  if (!tbody) return;

  // ✅ 이미 바인딩 됐으면 다시 안 붙임
  if (tbody.dataset.bound === "1") return;
  tbody.dataset.bound = "1";

  tbody.addEventListener("click", async (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;

    const id = Number(tr.dataset.id);
    const row = getRows().find((r) => r.id === id);
    if (!row) return;

    if (e.target.closest(".btn-guide")) {
      if (row.customer_type !== "안심회원") return alert("수리안내는 안심회원만 가능합니다.");
      if (!asBool(row.guide_due)) return alert("아직 수리안내 기간이 아닙니다. (90일 이후 활성)");

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

    if (e.target.closest(".btn-edit")) return setModal("edit", row);

    if (e.target.closest(".btn-del")) {
      if (!confirm("삭제하시겠습니까")) return;
      await api.remove(id);
      await load();
    }
  });
}

function bindExcelEvents() {
  $("#btnExcel")?.addEventListener("click", () => {
    const rows = window.__rows || [];
    if (!rows.length) return alert("다운로드할 데이터가 없습니다.");
    if (typeof XLSX === "undefined")
      return alert("XLSX 라이브러리가 로드되지 않았습니다.");

    const data = rows.map((r, idx) => ({
      No: rows.length - idx,
      날짜: r.date || "",
      성명: r.name || "",
      전화번호: r.phone || "",
      "카드사(신용카드)": r.card_company || "",
      할부개월: Number(r.installment_mon || 0),
      카드: Number(r.pay_card || 0),
      현금: Number(r.pay_cash || 0),
      입금: Number(r.pay_bank || 0),
      제품: r.product || "",
      차량: r.car || "",
      수리내용: r.desc || "",
      상태: r.customer_type || "",
      수리안내일: r.guide_date || "",
      안내상태: r.guide_done
        ? "안내완료"
        : r.guide_due
        ? "수리안내"
        : "대기중",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    ws["!cols"] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 10 },
      { wch: 16 },
      { wch: 16 },
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 30 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "현재조회");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Navi_수리내역_${today}.xlsx`);
  });
}

export function bindEvents() {
  bindSearchEvents();
  bindModalEvents();
  bindTableEvents();
  bindExcelEvents();

  // ✅ 관리자 버튼은 records에서 처리하지 않음 (a href="/admin" 링크로 이동)
  // => records.html에서 <a id="btnAdmin" href="/admin" ...> 로만 두면 끝
}