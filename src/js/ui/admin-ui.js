// ── admin-ui.js – Benutzerverwaltung Modal ─────────────────────────────────
import { apiFetch } from '../core/auth.js';

const MODAL_ID = 'admin-modal';

// ── Modal HTML ────────────────────────────────────────────────────────────
function _html() {
  return `
  <div id="${MODAL_ID}" style="display:flex;position:fixed;inset:0;z-index:99998;
    align-items:center;justify-content:center;background:rgba(0,0,0,0.7);">
    <div class="bg-[#1e1e1e] border border-[#3a3a3a] rounded-2xl shadow-2xl w-[700px] max-h-[85vh] flex flex-col">

      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-[#3a3a3a]">
        <div class="flex items-center gap-2">
          <i data-lucide="users" class="w-5 h-5 text-[#13d38e]"></i>
          <h2 class="text-white font-bold text-base">Benutzerverwaltung</h2>
        </div>
        <button id="admin-close" class="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded hover:bg-[#333]">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Toolbar: Neuer Benutzer -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-[#3a3a3a]">
        <button id="admin-btn-new"
          class="bg-[#13d38e] hover:bg-[#0fa678] text-black text-xs font-semibold px-4 py-1.5 rounded transition flex items-center gap-1.5">
          <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
          Neuer Benutzer
        </button>
        <span id="admin-status" class="text-xs text-gray-400 ml-auto"></span>
      </div>

      <!-- User-Tabelle -->
      <div class="overflow-y-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-[#1e1e1e]">
            <tr class="border-b border-[#3a3a3a] text-gray-400 text-xs uppercase tracking-wide">
              <th class="px-4 py-2 text-left">Benutzer</th>
              <th class="px-4 py-2 text-left">Rolle</th>
              <th class="px-4 py-2 text-left">Typ</th>
              <th class="px-4 py-2 text-left">Letzter Login</th>
              <th class="px-4 py-2 text-left">Status</th>
              <th class="px-4 py-2 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody id="admin-tbody">
            <tr><td colspan="6" class="px-4 py-6 text-center text-gray-500">Lade…</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Create / Edit User Form (overlay on top) -->
  <div id="admin-form-overlay" style="display:none;position:fixed;inset:0;z-index:99999;
    align-items:center;justify-content:center;background:rgba(0,0,0,0.5);">
    <div class="bg-[#1e1e1e] border border-[#3a3a3a] rounded-xl shadow-2xl w-[380px] p-6">
      <h3 id="admin-form-title" class="text-white font-bold text-sm mb-4">Neuer Benutzer</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-gray-400 text-xs mb-1">Benutzername</label>
          <input id="af-username" type="text"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#13d38e]"
            placeholder="benutzername" />
        </div>
        <div id="af-password-row">
          <label class="block text-gray-400 text-xs mb-1">Passwort <span id="af-pw-hint" class="text-gray-600">(leer lassen = unverändert)</span></label>
          <input id="af-password" type="password"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#13d38e]"
            placeholder="••••••••" />
        </div>
        <div>
          <label class="block text-gray-400 text-xs mb-1">E-Mail</label>
          <input id="af-email" type="email"
            class="w-full bg-[#1a1a1a] border border-[#444] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#13d38e]"
            placeholder="user@example.com" />
        </div>
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="block text-gray-400 text-xs mb-1">Rolle</label>
            <select id="af-role"
              class="w-full bg-[#1a1a1a] border border-[#444] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#13d38e]">
              <option value="user">Benutzer</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div class="flex-1">
            <label class="block text-gray-400 text-xs mb-1">Typ</label>
            <select id="af-auth-type"
              class="w-full bg-[#1a1a1a] border border-[#444] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#13d38e]">
              <option value="local">Lokal</option>
              <option value="ldap">LDAP</option>
              <option value="checkmk">Checkmk</option>
            </select>
          </div>
        </div>
        <div id="af-error" class="hidden text-red-400 text-xs bg-red-900/20 border border-red-800 rounded px-3 py-2"></div>
      </div>
      <div class="flex gap-3 mt-5">
        <button id="af-cancel"
          class="flex-1 bg-[#2b2b2b] border border-[#444] hover:bg-[#3a3a3a] text-sm font-semibold py-2 rounded transition">
          Abbrechen
        </button>
        <button id="af-save"
          class="flex-1 bg-[#13d38e] hover:bg-[#0fa678] text-black text-sm font-semibold py-2 rounded transition">
          Speichern
        </button>
      </div>
    </div>
  </div>`;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────
function _fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
}

function _roleLabel(role) {
  return role === 'admin'
    ? '<span class="text-xs bg-[#13d38e]/15 text-[#13d38e] px-2 py-0.5 rounded font-semibold">Admin</span>'
    : '<span class="text-xs bg-[#2b2b2b] text-gray-400 px-2 py-0.5 rounded">User</span>';
}

function _typeLabel(type) {
  const colors = { local: '#60a5fa', ldap: '#f59e0b', checkmk: '#a78bfa' };
  const c = colors[type] || '#9ca3af';
  return `<span class="text-xs font-medium" style="color:${c}">${type}</span>`;
}

function _statusLabel(active) {
  return active
    ? '<span class="text-xs text-green-400">Aktiv</span>'
    : '<span class="text-xs text-red-400">Deaktiviert</span>';
}

// ── Tabelle rendern ───────────────────────────────────────────────────────
function _renderTable(users) {
  const tbody = document.getElementById('admin-tbody');
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-500">Keine Benutzer</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr class="border-b border-[#2b2b2b] hover:bg-[#232323] transition" data-uid="${u.id}">
      <td class="px-4 py-3">
        <div class="font-medium text-white">${u.username}</div>
        <div class="text-xs text-gray-500">${u.email || ''}</div>
      </td>
      <td class="px-4 py-3">${_roleLabel(u.role)}</td>
      <td class="px-4 py-3">${_typeLabel(u.auth_type)}</td>
      <td class="px-4 py-3 text-gray-400 text-xs">${_fmtDate(u.last_login)}</td>
      <td class="px-4 py-3">${_statusLabel(u.active !== false)}</td>
      <td class="px-4 py-3 text-right flex items-center justify-end gap-1">
        <button class="admin-btn-toggle text-xs px-2 py-1 rounded border border-[#444] hover:bg-[#333] transition"
          data-uid="${u.id}" data-active="${u.active !== false}"
          title="${u.active !== false ? 'Deaktivieren' : 'Aktivieren'}">
          ${u.active !== false ? '<i data-lucide="toggle-right" class="w-4 h-4 text-green-400"></i>' : '<i data-lucide="toggle-left" class="w-4 h-4 text-gray-400"></i>'}
        </button>
        <button class="admin-btn-edit text-xs px-2 py-1 rounded border border-[#444] hover:bg-[#333] transition"
          data-uid="${u.id}" title="Bearbeiten">
          <i data-lucide="pencil" class="w-4 h-4 text-blue-400"></i>
        </button>
        <button class="admin-btn-del text-xs px-2 py-1 rounded border border-[#444] hover:bg-[#333] transition"
          data-uid="${u.id}" data-name="${u.username}" title="Löschen">
          <i data-lucide="trash-2" class="w-4 h-4 text-red-400"></i>
        </button>
      </td>
    </tr>`).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Benutzer laden ────────────────────────────────────────────────────────
async function _loadUsers() {
  const tbody = document.getElementById('admin-tbody');
  const statusEl = document.getElementById('admin-status');
  try {
    const res = await apiFetch('/users');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const users = await res.json();
    _renderTable(users);
    if (statusEl) statusEl.textContent = `${users.length} Benutzer`;
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-red-400">Fehler: ${e.message}</td></tr>`;
  }
}

// ── Formular-Logik ────────────────────────────────────────────────────────
let _editId = null;

function _openForm(user = null) {
  _editId = user?.id ?? null;
  const overlay  = document.getElementById('admin-form-overlay');
  const title    = document.getElementById('admin-form-title');
  const pwHint   = document.getElementById('af-pw-hint');
  if (!overlay) return;

  document.getElementById('af-username').value  = user?.username  ?? '';
  document.getElementById('af-password').value  = '';
  document.getElementById('af-email').value     = user?.email     ?? '';
  document.getElementById('af-role').value      = user?.role      ?? 'user';
  document.getElementById('af-auth-type').value = user?.auth_type ?? 'local';
  document.getElementById('af-error').classList.add('hidden');

  document.getElementById('af-username').disabled = !!user;   // Username nicht änderbar
  if (title) title.textContent = user ? `Benutzer bearbeiten: ${user.username}` : 'Neuer Benutzer';
  if (pwHint) pwHint.style.display = user ? '' : 'none';

  overlay.style.display = 'flex';
  document.getElementById('af-username').focus();
}

function _closeForm() {
  const overlay = document.getElementById('admin-form-overlay');
  if (overlay) overlay.style.display = 'none';
  _editId = null;
}

async function _saveForm() {
  const username  = document.getElementById('af-username').value.trim();
  const password  = document.getElementById('af-password').value;
  const email     = document.getElementById('af-email').value.trim();
  const role      = document.getElementById('af-role').value;
  const auth_type = document.getElementById('af-auth-type').value;
  const errEl     = document.getElementById('af-error');

  if (!_editId && !username) {
    _showFormErr('Benutzername ist erforderlich');
    return;
  }
  const btn = document.getElementById('af-save');
  btn.disabled = true;
  btn.textContent = 'Speichern…';

  try {
    let res;
    if (_editId) {
      // Update
      const body = { role, email, active: true };
      if (password) body.password = password;
      res = await apiFetch(`/users/${_editId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } else {
      // Create
      res = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, role, auth_type, email }),
      });
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail || `HTTP ${res.status}`);
    }
    _closeForm();
    await _loadUsers();
  } catch (e) {
    _showFormErr(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Speichern';
  }
}

function _showFormErr(msg) {
  const el = document.getElementById('af-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── Event-Delegation für Tabellen-Buttons ─────────────────────────────────
async function _onTableClick(e) {
  const toggleBtn = e.target.closest('.admin-btn-toggle');
  const editBtn   = e.target.closest('.admin-btn-edit');
  const delBtn    = e.target.closest('.admin-btn-del');

  if (toggleBtn) {
    const uid    = toggleBtn.dataset.uid;
    const active = toggleBtn.dataset.active === 'true';
    try {
      const res = await apiFetch(`/users/${uid}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !active }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await _loadUsers();
    } catch (e) {
      alert(`Fehler: ${e.message}`);
    }
    return;
  }

  if (editBtn) {
    const uid = editBtn.dataset.uid;
    // Lade aktuellen User aus der Tabelle (DOM)
    const row = editBtn.closest('tr');
    const username = row?.querySelector('td:first-child .font-medium')?.textContent?.trim() ?? '';
    const email    = row?.querySelector('td:first-child .text-xs')?.textContent?.trim() ?? '';
    const role     = row?.querySelector('td:nth-child(2) span')?.textContent?.toLowerCase().trim() === 'admin' ? 'admin' : 'user';
    const authType = row?.querySelector('td:nth-child(3) span')?.textContent?.trim() ?? 'local';
    _openForm({ id: uid, username, email, role, auth_type: authType });
    return;
  }

  if (delBtn) {
    const uid  = delBtn.dataset.uid;
    const name = delBtn.dataset.name;
    if (!confirm(`Benutzer "${name}" wirklich löschen?`)) return;
    try {
      const res = await apiFetch(`/users/${uid}`, { method: 'DELETE' });
      if (res.status === 204 || res.ok) {
        await _loadUsers();
      } else {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `HTTP ${res.status}`);
      }
    } catch (e) {
      alert(`Fehler: ${e.message}`);
    }
  }
}

// ── Öffnen / Schließen ────────────────────────────────────────────────────
function _remove() {
  document.getElementById(MODAL_ID)?.remove();
  document.getElementById('admin-form-overlay')?.remove();
}

export function openAdminModal() {
  _remove();
  document.body.insertAdjacentHTML('beforeend', _html());
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('admin-close')?.addEventListener('click', _remove);
  document.getElementById('admin-btn-new')?.addEventListener('click', () => _openForm());
  document.getElementById('af-cancel')?.addEventListener('click', _closeForm);
  document.getElementById('af-save')?.addEventListener('click', _saveForm);
  document.getElementById('admin-tbody')?.addEventListener('click', _onTableClick);

  // Schließen bei Klick außerhalb
  document.getElementById(MODAL_ID)?.addEventListener('click', e => {
    if (e.target.id === MODAL_ID) _remove();
  });

  _loadUsers();
}
