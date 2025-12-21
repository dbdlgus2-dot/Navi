// web/js/ui.js
import { $, fmt, toYMD } from "./util.js";

function badge(status) {
  if (status === "안심회원") return `<span class="badge badge-pill badge-safe">안심회원</span>`;
  if (status === "무상") return `<span class="badge badge-pill badge-free">무상</span>`;
  return `<span class="badge badge-pill badge-normal">일반</span>`;
}

export function renderRows(rows) {
  const tbody = $("#tbody");
  if (!tbody) return;

  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.id}">
      <td><b>${r.id}</b></td>
      <td>${toYMD(r.date)}</td>

      <td>
        <div class="name-main">${r.name || ""}</div>
        <div class="name-sub">${r.memo || ""}</div>
      </td>

      <td>${r.phone || ""}</td>

      <td>
        <div class="pay-line"><small>카드</small> <b>${fmt(r.pay_card)}</b></div>
        <div class="pay-line"><small>현금</small> <b>${fmt(r.pay_cash)}</b></div>
        <div class="pay-line"><small>입금</small> <b>${fmt(r.pay_bank)}</b></div>
      </td>

      <td>
        <div class="name-main">${r.product || ""}</div>
        <div class="name-sub">${r.car || ""}</div>
      </td>

      <td>${r.desc || ""}</td>
      <td>${badge(r.status)}</td>

      <td class="text-end">
        <button class="btn btn-outline-secondary btn-action me-2 btn-edit" type="button">수정</button>
        <button class="btn btn-outline-danger btn-action btn-del" type="button">삭제</button>
      </td>
    </tr>
  `).join("");
}

export function renderSums(rows) {
  const sumCard = rows.reduce((a, r) => a + Number(r.pay_card || 0), 0);
  const sumCash = rows.reduce((a, r) => a + Number(r.pay_cash || 0), 0);
  const sumBank = rows.reduce((a, r) => a + Number(r.pay_bank || 0), 0);

  $("#sumCard") && ($("#sumCard").textContent = fmt(sumCard));
  $("#sumCash") && ($("#sumCash").textContent = fmt(sumCash));
  $("#sumBank") && ($("#sumBank").textContent = fmt(sumBank));
  $("#sumTotal") && ($("#sumTotal").textContent = fmt(sumCard + sumCash + sumBank));
}