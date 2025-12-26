import { $, initDefaultDates } from "./util.js";
import { apiList, apiCreate, apiUpdate, apiRemove } from "./api.js";
import { renderTable, renderSums, createModalController } from "./ui.js";

(async () => {
  const modal = createModalController();
  let rows = [];

  async function load() {
    rows = await apiList();
    renderTable(rows);
    renderSums(rows);
  }

  // events
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

  $("#btnNew")?.addEventListener("click", () => modal.open("new"));

  $("#btnSave")?.addEventListener("click", async () => {
    try {
      const payload = modal.getPayload();
      if (payload.id) await apiUpdate(payload);
      else await apiCreate(payload);
      modal.close();
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

    if (e.target.closest(".btn-edit")) modal.open("edit", row);

    if (e.target.closest(".btn-del")) {
      if (!confirm("삭제할까요?")) return;
      try {
        await apiRemove(id);
        await load();
      } catch (err) {
        console.error(err);
        alert(err.message || "삭제 실패");
      }
    }
  });

  // first load
  initDefaultDates({ force: true });
  await load();
})();