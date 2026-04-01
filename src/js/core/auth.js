// ── auth.js – Token-Management & API-fetch-Wrapper ────────────────────────
const LS_TOKEN = 'bi_token';
const LS_USER  = 'bi_user';

// ── Zustand ───────────────────────────────────────────────────────────────
let _token = localStorage.getItem(LS_TOKEN) || null;
let _user  = JSON.parse(localStorage.getItem(LS_USER) || 'null');

export function getToken()    { return _token; }
export function getCurrentUser() { return _user; }
export function isLoggedIn()  { return !!_token; }
export function isAdmin()     { return _user?.role === 'admin'; }

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
    import('./auth.js').then(m => m.showLoginModal());
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

// ── showLoginModal – wird von login.js überschrieben ─────────────────────
export let showLoginModal = () => {};
export function registerLoginModal(fn) { showLoginModal = fn; }
