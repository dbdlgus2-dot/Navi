// web/js/records.js
"use strict";

import { initPage } from "./records.page.js";
import { bindEvents } from "./records.events.js";

document.addEventListener("DOMContentLoaded", () => {
  initPage();     // 날짜 초기화 + load
  bindEvents();   // 이벤트 바인딩(검색/저장/테이블/엑셀)
});