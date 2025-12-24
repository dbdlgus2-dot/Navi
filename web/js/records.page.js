// web/js/records.page.js
import { $, initDefaultDates, normalizeRow } from "./util.js";
import { api } from "./api.js";
import { renderRows, renderSums } from "./ui.js";
import { bindEvents } from "./records.events.js"; 

let rows = [];

export function getRows() {
  return rows;
}

export function asBool(v) {
  return v === true || v === 1 || v === "1" || v === "t" || v === "true";
}

export function buildQueryString() {
  const qs = new URLSearchParams();

  const from = $("#dateFrom")?.value || "";
  const to = $("#dateTo")?.value || "";
  const q = ($("#q")?.value || "").trim();

  const safe = $("#onlySafe")?.checked ? "1" : "";
  const revisit = $("#onlyRevisit")?.checked ? "1" : "";
  const isNew = $("#onlyNew")?.checked ? "1" : "";
  const guide = $("#onlyGuide")?.checked ? "1" : "";

  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (q) qs.set("q", q);

  if (safe) qs.set("safe", "1");
  if (revisit) qs.set("revisit", "1");
  if (isNew) qs.set("new", "1");
  if (guide) qs.set("guide", "1");

  return qs.toString();
}

export async function load() {
  const qs = buildQueryString();
  const data = await api.list(qs);

  rows = Array.isArray(data) ? data.map(normalizeRow) : [];

  // 디버그용
  window.__rows = rows;
  window.__lastQs = qs;

  renderRows(rows);
  renderSums(rows);
}

export function initPage() {
  initDefaultDates(true);
  load().catch((e) => {
    console.error(e);
    alert(e.message || "불러오기 실패");
  });
}
/* ✅ 관리자 버튼 표시 */
async function showAdminButtonIfAdmin() {
  const btn = document.querySelector("#btnAdmin");
  if (!btn) return;

  try {
    const r = await fetch("/api/me", { credentials: "include" });
    if (!r.ok) return; // 401이면 그냥 숨김 유지

    const me = await r.json();
    if (me?.role === "ADMIN") {
      btn.classList.remove("d-none"); // ✅ 관리자면 표시
    }
  } catch (e) {
    // 네트워크 오류면 숨김 유지
  }
}

function init() {
  initDefaultDates(true);
  showAdminButtonIfAdmin();   // ✅ 추가
  bindEvents();
  load().catch((e) => {
    console.error(e);
    alert(e.message || "불러오기 실패");
  });
}

document.addEventListener("DOMContentLoaded", init);