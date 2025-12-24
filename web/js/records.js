// web/js/records.js
import { initPage } from "./records.page.js";
import { bindEvents } from "./records.events.js";

document.addEventListener("DOMContentLoaded", async () => {
  initPage();
  bindEvents();
});
function init() {
  bindEvents();       
  // 기존 bindEvents/load 등...
}
document.addEventListener("DOMContentLoaded", init);