// Thin fetch wrapper over the Bunker Fridays API. Sessions ride on httpOnly
// cookies, so every call sends credentials and never touches a token directly.

async function req(method, path, body) {
  const opts = { method, credentials: "same-origin", headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, opts);
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data && data.code;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // ---- public ----
  calendar: () => req("GET", "/calendar"),
  info: () => req("GET", "/info"),
  submitRequest: (payload) => req("POST", "/requests", payload),
  myRequests: () => req("GET", "/me/requests"),
  cancelRequest: (id) => req("POST", `/me/requests/${id}/cancel`),
  myProfile: () => req("GET", "/me/profile"),
  saveProfile: (fields) => req("POST", "/me/profile", fields),
  addBlackout: (date, reason) => req("POST", "/me/blackouts", { date, reason }),
  removeBlackout: (date, reason) => req("DELETE", "/me/blackouts", { date, reason }),
  myPings: () => req("GET", "/me/pings"),
  markPingRead: (id) => req("POST", `/me/pings/${id}/read`),
  pushSubscribe: (subscription) => req("POST", "/admin/push/subscribe", { subscription }),
  photoPresign: (contentType) => req("POST", "/me/photos/presign", { contentType }),
  savePhotos: (photos) => req("POST", "/me/photos", { photos }),
  chat: (history) => req("POST", "/chat", { history }),

  // ---- artist auth ----
  signup: (payload) => req("POST", "/auth/signup", payload),
  login: (email, password) => req("POST", "/auth/login", { email, password }),
  logout: () => req("POST", "/auth/logout"),
  me: () => req("GET", "/auth/me"),
  requestReset: (email) => req("POST", "/auth/reset/request", { email }),
  completeReset: (token, password) => req("POST", "/auth/reset/complete", { token, password }),

  // ---- admin auth ----
  adminLogin: (email, password, totp) => req("POST", "/admin/auth/login", { email, password, totp }),
  adminLogout: () => req("POST", "/admin/auth/logout"),
  adminMe: () => req("GET", "/admin/auth/me"),
  adminTotpStart: () => req("POST", "/admin/auth/totp/start"),
  adminTotpConfirm: (secret, code) => req("POST", "/admin/auth/totp/confirm", { secret, code }),
  adminPassword: (current, next) => req("POST", "/admin/auth/password", { current, next }),

  // ---- admin desk ----
  adminState: () => req("GET", "/admin/state"),
  decide: (id, payload) => req("POST", `/admin/requests/${id}/decide`, payload),
  changeTime: (id, slot) => req("POST", `/admin/requests/${id}/time`, { slot }),
  venueCancel: (id, reason) => req("POST", `/admin/requests/${id}/cancel`, { reason: reason || "" }),
  toggleClosed: (date) => req("POST", `/admin/nights/${date}/closed`),
  setWriters: (date, writersOverride) => req("POST", `/admin/nights/${date}/writers`, { writersOverride }),
  addManual: (date, payload) => req("POST", `/admin/nights/${date}/manual`, payload),
  removeManual: (date, idx) => req("DELETE", `/admin/nights/${date}/manual/${idx}`),
  applyTimes: (date, changes) => req("POST", `/admin/nights/${date}/times`, { changes }),
  saveArtist: (id, fields) => req("PUT", `/admin/artists/${id}`, fields),
  createArtist: (fields) => req("POST", "/admin/artists", fields),
  deleteArtist: (id) => req("DELETE", `/admin/artists/${id}`),
  mergeArtists: (keepId, mergeId) => req("POST", "/admin/artists/merge", { keepId, mergeId }),
  clearPasses: (id) => req("POST", `/admin/artists/${id}/clear-passes`),
  markDraftSent: (id, sent) => req("POST", `/admin/drafts/${id}/sent`, { sent }),
  deleteDraft: (id) => req("DELETE", `/admin/drafts/${id}`),
  sendDraft: (id) => req("POST", `/admin/drafts/${id}/send`),
  runRecommend: (weeks) => req("POST", "/admin/recommend/run", { weeks }),
  passRecommend: (payload) => req("POST", "/admin/recommend/pass", payload),
  outreach: (payload) => req("POST", "/admin/recommend/outreach", payload),
  getRecConfig: () => req("GET", "/admin/recconfig"),
  setRecConfig: (cfg) => req("PUT", "/admin/recconfig", cfg),
  saveKb: (text) => req("PUT", "/admin/kb", { text }),
  setLocalCities: (cities) => req("PUT", "/admin/local-cities", { cities }),
  resolveEscalation: (id, resolved) => req("POST", `/admin/escalations/${id}/resolved`, { resolved }),
  workbookExportUrl: () => "/api/admin/workbook/export",
};

// VAPID base64url -> Uint8Array for PushManager.subscribe
export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
