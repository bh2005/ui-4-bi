// ── login.js – Login-Modal ────────────────────────────────────────────────
import { login, getAuthConfig, isLoggedIn, getCurrentUser,
         logout, isAdmin, registerLoginModal, apiFetch, setSession } from '../core/auth.js';

const MODAL_ID = 'login-modal';

function _html(cfg) {
  const methods = [];
  methods.push('<option value="local">Lokaler Benutzer</option>');
  if (cfg.ldap_enabled)  methods.push('<option value="ldap">LDAP / Active Directory</option>');
  if (cfg.cmk_enabled)   methods.push('<option value="cmk">Checkmk</option>');
  const methodSel = methods.length > 1
    ? `<div class="mb-3">
         <label class="block text-gray-400 text-xs mb-1">Anmeldung via</label>
         <select id="login-method" class="w-full bg-[#1a1a1a] border border-[#444] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#13d38e]">
           ${methods.join('')}
         </select>
       </div>` : '';

  return `
  <div id="${MODAL_ID}" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70">
    <div class="bg-[#1e1e1e] border border-[#3a3a3a] rounded-2xl shadow-2xl w-[360px] p-8">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-9 h-9 rounded-lg bg-[#13d38e]/15 flex items-center justify-center">
          <i data-lucide="shield" class="w-5 h-5 text-[#13d38e]"></i>
        </div>
        <div>
          <div class="text-white font-bold text-base">UI4BI</div>
          <div class="text-gray-500 text-xs">Bitte anmelden</div>
        </div>
      </div>

      ${methodSel}

      <div class="space-y-3">
        <div>
          <label class="block text-gray-400 text-xs mb-1">Benutzername</label>
          <input id="login-user" type="text" autocomplete="username"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#13d38e]"
            placeholder="admin">
        </div>
        <div>
          <label class="block text-gray-400 text-xs mb-1">Passwort</label>
          <input id="login-pw" type="password" autocomplete="current-password"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#13d38e]"
            placeholder="••••••••">
        </div>
      </div>

      <div id="login-error" class="hidden mt-3 text-red-400 text-xs bg-red-900/20 border border-red-800 rounded px-3 py-2"></div>

      <button id="login-submit"
        class="mt-5 w-full bg-[#13d38e] hover:bg-[#0fa678] text-black font-semibold py-2.5 rounded-lg transition text-sm">
        Anmelden
      </button>
    </div>
  </div>`;
}

function _remove() {
  document.getElementById(MODAL_ID)?.remove();
}

async function _show() {
  _remove();
  const cfg = await getAuthConfig();
  document.body.insertAdjacentHTML('beforeend', _html(cfg));
  if (typeof lucide !== 'undefined') lucide.createIcons();

  const userInp = document.getElementById('login-user');
  const pwInp   = document.getElementById('login-pw');
  const errEl   = document.getElementById('login-error');
  const btn     = document.getElementById('login-submit');

  userInp?.focus();

  const doLogin = async () => {
    const username = userInp?.value.trim();
    const password = pwInp?.value;
    if (!username) { _setErr('Benutzername eingeben'); return; }
    btn.disabled = true;
    btn.textContent = 'Anmelden…';
    errEl?.classList.add('hidden');
    try {
      const user = await login(username, password);
      _remove();
      _updateBadge(user);
    } catch (e) {
      _setErr(e.message);
      btn.disabled = false;
      btn.textContent = 'Anmelden';
    }
  };

  btn?.addEventListener('click', doLogin);
  pwInp?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  function _setErr(msg) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }
}

// ── User-Badge aktualisieren ──────────────────────────────────────────────
export function _updateBadge(user) {
  const nameEl = document.getElementById('user-badge-name');
  if (nameEl) nameEl.textContent = user?.username || 'anonymous';
  const roleEl = document.getElementById('user-badge-role');
  if (roleEl) roleEl.textContent = user?.role === 'admin' ? '⚙' : '';
  const adminBtn = document.getElementById('btn-admin');
  if (adminBtn) adminBtn.style.display = (user?.role === 'admin') ? '' : 'none';
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.style.display = user ? '' : 'none';
  const pwBtn = document.getElementById('btn-change-password');
  if (pwBtn) pwBtn.style.display = (user && user.auth_type === 'local') ? '' : 'none';
}

// ── Passwort-Änderung Modal ───────────────────────────────────────────────
const PW_MODAL_ID = 'pw-change-modal';

export function showChangePasswordModal() {
  document.getElementById(PW_MODAL_ID)?.remove();

  const html = `
  <div id="${PW_MODAL_ID}" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70">
    <div class="bg-[#1e1e1e] border border-[#3a3a3a] rounded-2xl shadow-2xl w-[340px] p-6">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <i data-lucide="key-round" class="w-5 h-5 text-[#13d38e]"></i>
          <h3 class="text-white font-bold text-sm">Passwort ändern</h3>
        </div>
        <button id="pw-modal-close" class="text-gray-500 hover:text-white w-7 h-7 flex items-center justify-center rounded hover:bg-[#333]">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="block text-gray-400 text-xs mb-1">Aktuelles Passwort</label>
          <input id="pw-old" type="password" autocomplete="current-password"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#13d38e]"
            placeholder="••••••••">
        </div>
        <div>
          <label class="block text-gray-400 text-xs mb-1">Neues Passwort</label>
          <input id="pw-new" type="password" autocomplete="new-password"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#13d38e]"
            placeholder="••••••••">
        </div>
        <div>
          <label class="block text-gray-400 text-xs mb-1">Neues Passwort (wiederholen)</label>
          <input id="pw-confirm" type="password" autocomplete="new-password"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#13d38e]"
            placeholder="••••••••">
        </div>
        <div id="pw-error" class="hidden text-red-400 text-xs bg-red-900/20 border border-red-800 rounded px-3 py-2"></div>
        <div id="pw-ok" class="hidden text-green-400 text-xs bg-green-900/20 border border-green-800 rounded px-3 py-2">
          Passwort erfolgreich geändert.
        </div>
      </div>
      <div class="flex gap-3 mt-5">
        <button id="pw-cancel"
          class="flex-1 bg-[#2b2b2b] border border-[#444] hover:bg-[#3a3a3a] text-sm font-semibold py-2 rounded transition">
          Abbrechen
        </button>
        <button id="pw-save"
          class="flex-1 bg-[#13d38e] hover:bg-[#0fa678] text-black text-sm font-semibold py-2 rounded transition">
          Speichern
        </button>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  const close = () => document.getElementById(PW_MODAL_ID)?.remove();
  document.getElementById('pw-modal-close')?.addEventListener('click', close);
  document.getElementById('pw-cancel')?.addEventListener('click', close);
  document.getElementById(PW_MODAL_ID)?.addEventListener('click', e => {
    if (e.target.id === PW_MODAL_ID) close();
  });

  document.getElementById('pw-save')?.addEventListener('click', async () => {
    const oldPw  = document.getElementById('pw-old').value;
    const newPw  = document.getElementById('pw-new').value;
    const confirm = document.getElementById('pw-confirm').value;
    const errEl  = document.getElementById('pw-error');
    const okEl   = document.getElementById('pw-ok');
    const btn    = document.getElementById('pw-save');

    errEl.classList.add('hidden');
    okEl.classList.add('hidden');

    if (!oldPw)          { _showPwErr(errEl, 'Aktuelles Passwort eingeben'); return; }
    if (newPw.length < 6) { _showPwErr(errEl, 'Neues Passwort mindestens 6 Zeichen'); return; }
    if (newPw !== confirm) { _showPwErr(errEl, 'Passwörter stimmen nicht überein'); return; }

    btn.disabled = true;
    btn.textContent = 'Speichern…';
    try {
      const res = await apiFetch('/me/password', {
        method: 'PUT',
        body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `HTTP ${res.status}`);
      }
      okEl.classList.remove('hidden');
      document.getElementById('pw-old').value = '';
      document.getElementById('pw-new').value = '';
      document.getElementById('pw-confirm').value = '';
      setTimeout(close, 1500);
    } catch (e) {
      _showPwErr(errEl, e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Speichern';
    }
  });

  document.getElementById('pw-old')?.focus();
}

function _showPwErr(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── Init ──────────────────────────────────────────────────────────────────
export async function initLogin() {
  registerLoginModal(_show);

  const cfg = await getAuthConfig();
  if (!cfg.auth_enabled) return;  // Auth deaktiviert → kein Login nötig

  if (!isLoggedIn()) {
    await _show();
    return;
  }
  _updateBadge(getCurrentUser());

  // Logout-Button verdrahten
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.style.display = '';
    logoutBtn.addEventListener('click', () => {
      if (confirm('Wirklich abmelden?')) logout();
    });
  }

  // Passwort-Änderung Button verdrahten
  document.getElementById('btn-change-password')
    ?.addEventListener('click', showChangePasswordModal);
}
