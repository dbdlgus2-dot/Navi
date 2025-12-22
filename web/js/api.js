// web/js/api.js
"use strict";

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  // 로그인 만료 처리
  if (res.status === 401) {
    location.href = "/login";
    return null;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "요청 실패");
  return data;
}

export const api = {
  // 목록 조회
  list: (qs = "") =>
    fetchJSON(`/api/repairs${qs ? `?${qs}` : ""}`, { method: "GET" }),

  // 생성
  create: (payload) =>
    fetchJSON("/api/repairs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // 수정
  update: (payload) =>
    fetchJSON("/api/repairs", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  // 삭제
  remove: (id) =>
    fetchJSON(`/api/repairs/${id}`, {
      method: "DELETE",
    }),

  // ✅ 수리안내 완료 처리 (guide_done=true, guide_date=now()::date)
  guideDone: (id) =>
    fetchJSON(`/api/repairs/${id}/guide-done`, {
      method: "POST",
    }),
};