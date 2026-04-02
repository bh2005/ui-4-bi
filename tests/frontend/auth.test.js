/**
 * Tests für js/core/auth.js
 *   - JWT-Payload dekodieren
 *   - Abgelaufene Tokens erkennen
 *   - setSession / clearSession / isLoggedIn
 *   - apiFetch hängt Bearer-Token an
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// localStorage mocken (jsdom stellt es bereit, aber wir resetten zwischen Tests)
beforeEach(() => localStorage.clear());

// fetch global mocken
const fetchMock = vi.fn();
global.fetch = fetchMock;

// auth.js importieren — importiert localStorage (jsdom) und fetch (mock)
// Da auth.js beim Import sofort Code ausführt (Startup-Check),
// importieren wir nach beforeEach-Reset durch dynamischen Import.
async function loadAuth() {
  vi.resetModules();
  return await import('../../src/js/core/auth.js');
}

// ── JWT-Hilfe (Test-Tokens ohne Bibliothek erzeugen) ──────────────────────
function makeToken(payload) {
  const enc = s => btoa(unescape(encodeURIComponent(JSON.stringify(s))))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.fakesig`;
}

function expiredToken() {
  return makeToken({ sub: 'alice', role: 'user', exp: Math.floor(Date.now() / 1000) - 60 });
}

function validToken(extraMinutes = 60) {
  return makeToken({
    sub: 'bob', role: 'admin', id: 'u1', auth_type: 'local',
    exp: Math.floor(Date.now() / 1000) + extraMinutes * 60,
  });
}


describe('Startup – abgelaufenes Token verwirft', () => {
  it('abgelaufenes Token in localStorage wird beim Import entfernt', async () => {
    localStorage.setItem('bi_token', expiredToken());
    localStorage.setItem('bi_user', JSON.stringify({ username: 'alice' }));
    const auth = await loadAuth();
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('bi_token')).toBeNull();
  });

  it('gültiges Token in localStorage bleibt erhalten', async () => {
    const tok = validToken();
    localStorage.setItem('bi_token', tok);
    localStorage.setItem('bi_user', JSON.stringify({ username: 'bob', role: 'admin' }));
    const auth = await loadAuth();
    expect(auth.isLoggedIn()).toBe(true);
  });
});


describe('setSession / clearSession / isLoggedIn', () => {
  it('setSession speichert Token und User', async () => {
    const auth = await loadAuth();
    const tok  = validToken();
    auth.setSession(tok, { username: 'bob', role: 'admin' });
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.getCurrentUser()?.username).toBe('bob');
    expect(localStorage.getItem('bi_token')).toBe(tok);
  });

  it('clearSession entfernt Token und User', async () => {
    const auth = await loadAuth();
    auth.setSession(validToken(), { username: 'bob' });
    auth.clearSession();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.getCurrentUser()).toBeNull();
    expect(localStorage.getItem('bi_token')).toBeNull();
  });

  it('isAdmin gibt true für Admin-User', async () => {
    const auth = await loadAuth();
    auth.setSession(validToken(), { username: 'bob', role: 'admin' });
    expect(auth.isAdmin()).toBe(true);
  });

  it('isAdmin gibt false für normalen User', async () => {
    const auth = await loadAuth();
    auth.setSession(validToken(), { username: 'carol', role: 'user' });
    expect(auth.isAdmin()).toBe(false);
  });
});


describe('apiFetch', () => {
  it('hängt Bearer-Token an wenn eingeloggt', async () => {
    const auth = await loadAuth();
    const tok  = validToken();
    auth.setSession(tok, { username: 'bob' });

    fetchMock.mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({}) });
    await auth.apiFetch('/test');

    expect(fetchMock).toHaveBeenCalledWith('/test', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: `Bearer ${tok}` }),
    }));
  });

  it('kein Authorization-Header wenn nicht eingeloggt', async () => {
    const auth = await loadAuth();

    fetchMock.mockResolvedValueOnce({ status: 200, ok: true });
    await auth.apiFetch('/test');

    const call = fetchMock.mock.calls[0];
    expect(call[1].headers?.Authorization).toBeUndefined();
  });

  it('401-Response löscht Session und wirft Error', async () => {
    const auth = await loadAuth();
    auth.setSession(validToken(), { username: 'bob' });

    fetchMock.mockResolvedValueOnce({ status: 401, ok: false });
    await expect(auth.apiFetch('/protected')).rejects.toThrow();
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('setzt Content-Type: application/json', async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValueOnce({ status: 200, ok: true });
    await auth.apiFetch('/data');

    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
  });

  it('leitet options.headers weiter', async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValueOnce({ status: 200, ok: true });
    await auth.apiFetch('/data', { headers: { 'X-Custom': 'yes' } });

    expect(fetchMock.mock.calls[0][1].headers['X-Custom']).toBe('yes');
  });
});


describe('getAuthConfig', () => {
  it('cached das Ergebnis (fetch nur einmal)', async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValue({
      status: 200, ok: true,
      json: async () => ({ auth_enabled: false, ldap_enabled: false, cmk_enabled: false }),
    });
    await auth.getAuthConfig();
    await auth.getAuthConfig();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gibt Fallback zurück wenn Backend nicht erreichbar', async () => {
    vi.resetModules();
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const auth = await import('../../src/js/core/auth.js');
    const cfg = await auth.getAuthConfig();
    expect(cfg.auth_enabled).toBe(false);
  });
});
