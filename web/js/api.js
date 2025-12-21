// web/js/api.js
async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    location.href = "/login";
    return null;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "요청 실패");
  return data;
}

export const api = {
  list: (qs) => fetchJSON(`/api/repairs${qs ? `?${qs}` : ""}`, { method: "GET" }),
  create: (payload) =>
    fetchJSON("/api/repairs", { method: "POST", body: JSON.stringify(payload) }),
  update: (payload) =>
    fetchJSON("/api/repairs", { method: "PUT", body: JSON.stringify(payload) }),
  remove: (id) => fetchJSON(`/api/repairs/${id}`, { method: "DELETE" }),
};