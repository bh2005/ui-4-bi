// ── auth.js – Token-Management & API-fetch-Wrapper ────────────────────────
const LS_TOKEN = 'bi_token';
export const LS_USER = 'bi_user';

// ── JWT-Payload dekodieren (ohne Bibliothek) ──────────────────────────────
function _decodePayload(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch { return null; }
}

function _isExpired(token) {
  if (!token) return true;
  const p = _decodePayload(token);
  return p?.exp ? p.exp * 1000 < Date.now() : false;
}

// ── Zustand ───────────────────────────────────────────────────────────────
let _token    = localStorage.getItem(LS_TOKEN) || null;
let _user     = JSON.parse(localStorage.getItem(LS_USER) || 'null');
let _expTimer = null;

// Abgelaufenes Token beim Start sofort verwerfen
if (_isExpired(_token)) {
  _token = null;
  _user  = null;
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER);
}

// ── showLoginModal – wird von login.js überschrieben ─────────────────────
export let showLoginModal = () => {};
export function registerLoginModal(fn) { showLoginModal = fn; }

// ── Token-Ablauf-Timer ────────────────────────────────────────────────────
function _scheduleExpiry(token) {
  if (_expTimer) { clearTimeout(_expTimer); _expTimer = null; }
  if (!token) return;
  const payload = _decodePayload(token);
  if (!payload?.exp) return;
  // 60 Sekunden vor Ablauf Session löschen und Login-Modal zeigen
  const msLeft = payload.exp * 1000 - Date.now() - 60_000;
  if (msLeft <= 0) {
    clearSession();
    showLoginModal();
    return;
  }
  _expTimer = setTimeout(() => {
    clearSession();
    showLoginModal();
  }, msLeft);
}

// ── Öffentliche Zustandsfunktionen ────────────────────────────────────────
export function getToken()       { return _token; }
export function getCurrentUser() { return _user; }
export function isLoggedIn()     { return !!_token; }
export function isAdmin()        { return _user?.role === 'admin'; }

export function setSession(token, user) {
  _token = token;
  _user  = user;
  if (token) {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER,  JSON.stringify(user));
  } else {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
  }
  _scheduleExpiry(token);
}

export function clearSession() {
  setSession(null, null);
}

// ── Fetch-Wrapper: hängt Bearer-Token an alle Requests ───────────────────
export async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearSession();
    showLoginModal();
    throw new Error('Session abgelaufen – bitte neu anmelden');
  }
  return res;
}

// ── Auth-Konfiguration vom Backend laden ─────────────────────────────────
let _authConfig = null;
export async function getAuthConfig() {
  if (_authConfig) return _authConfig;
  try {
    const r = await fetch('/auth/config');
    _authConfig = await r.json();
  } catch {
    _authConfig = { auth_enabled: false, ldap_enabled: false, cmk_enabled: false };
  }
  return _authConfig;
}

// ── Login / Logout ────────────────────────────────────────────────────────
export async function login(username, password) {
  const r = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.detail || 'Login fehlgeschlagen');
  }
  const { token, user } = await r.json();
  setSession(token, user);
  return user;
}

export function logout() {
  clearSession();
  window.location.reload();
}
