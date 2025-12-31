// web/js/ui.js
import { $, fmt, toYMD } from "./util.js";

// ✅ boolean 값 섞여 들어오는 것들 정규화
function asBool(v) {
  return v === true || v === 1 || v === "1" || v === "t" || v === "true";
}

// ✅ 뱃지: customer_type 기준(안심회원/재방문/신규/일반)
function badge(customerType) {
  if (customerType === "안심회원") return `<span class="badge badge-pill badge-safe">안심회원</span>`;
  if (customerType === "재방문")  return `<span class="badge badge-pill badge-revisit">재방문</span>`;
  if (customerType === "수리")    return `<span class="badge badge-pill badge-repair">수리</span>`;
  return `<span class="badge badge-pill badge-new">신규</span>`;
}

function dateCell(d) {
  if (!d) return `<span class="text-muted">-</span>`;
  return toYMD(d);
}

// ✅ 수리안내 버튼: 안내완료 / 수리안내(활성) / 대기중(비활성)
// - 안내완료(done)면 무조건 완료 표시
// - 완료가 아니고 due면 "수리안내" 활성
// - 그 외는 대기중
function guideActionCell(r) {
  const done = asBool(r.guide_done);
  const due  = asBool(r.guide_due);

  // ✅ 완료면 버튼 말고 배지(클릭 불가)
  if (done) {
    return `<span class="badge bg-success">방문완료</span>`;
  }

  // ✅ 대상이면 클릭 가능한 버튼(여기만 btn-guide 유지)
  if (due) {
    return `<button class="btn btn-outline-primary btn-action btn-guide" type="button">방문확인</button>`;
  }

  // ✅ 대기중도 버튼 말고 텍스트/배지(클릭 불가)
  return `<span class="badge bg-secondary">대기중</span>`;
}

export function renderRows(rows) {
  const tbody = $("#tbody");
  if (!tbody) return;

  tbody.innerHTML = rows
    .map((r, idx) => {
      const rowNo = rows.length - idx;

      // ✅ customer_type가 "안심회원"일 때만 안내일/버튼 보여주기
      const isSafe = (r.customer_type === "안심회원");

      return `
        <tr data-id="${r.id}">
          <td><b>${rowNo}</b></td>
          <td>${toYMD(r.date)}</td>

          <td>
            <div class="name-main">${r.name || ""}</div>
            <div class="name-sub">${r.card_company || r.memo || ""}</div>
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

          <td>${badge(r.customer_type)}</td>

          <td>${isSafe ? dateCell(r.guide_date) : `<span class="text-muted">-</span>`}</td>

          <td class="text-end">
            ${isSafe ? guideActionCell(r) : ""}
            <button class="btn btn-outline-secondary btn-action ms-2 btn-edit" type="button">수정</button>
            <button class="btn btn-outline-danger btn-action ms-2 btn-del" type="button">삭제</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

export function renderSums(rows) {
  const sumCard = rows.reduce((a, r) => a + Number(r.pay_card || 0), 0);
  const sumCash = rows.reduce((a, r) => a + Number(r.pay_cash || 0), 0);
  const sumBank = rows.reduce((a, r) => a + Number(r.pay_bank || 0), 0);

  $("#sumCard") && ($("#sumCard").textContent = fmt(sumCard));
  $("#sumCash") && ($("#sumCash").textContent = fmt(sumCash));
  $("#sumBank") && ($("#sumBank").textContent = fmt(sumBank));
  $("#sumTotal") &&
    ($("#sumTotal").textContent = fmt(sumCard + sumCash + sumBank));
}