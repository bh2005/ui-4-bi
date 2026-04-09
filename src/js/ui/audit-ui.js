import { state, auditLog, graphState } from '../core/state.js';
import { LS_USER } from '../core/auth.js';
import { escHtml } from '../utils/dom-utils.js';

// ── Toast ─────────────────────────────────────────────────────────────────
export function showToast(msg, ok = true) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      padding:10px 20px;border-radius:8px;font-size:14px;z-index:9999;
      transition:opacity .3s;pointer-events:none;`;
    document.body.appendChild(t);
  }
  t.textContent      = msg;
  t.style.background = ok ? '#13d38e' : '#e74c3c';
  t.style.color      = ok ? '#000'    : '#fff';
  t.style.opacity    = '1';
  clearTimeout(t._to);
  t._to = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// ── User Badge ────────────────────────────────────────────────────────────
export function updateUserBadge() {
  const badge = document.getElementById('user-badge-name');
  if (badge) badge.textContent = state.currentUser;
}

export function initUserBadge() {
  updateUserBadge();

  if (!localStorage.getItem(LS_USER)) {
    const banner = document.getElementById('username-banner');
    if (banner) banner.style.display = 'flex';
  }

  document.getElementById('username-banner-save')?.addEventListener('click', () => {
    const inp = document.getElementById('username-banner-input');
    if (!inp) return;
    const name = inp.value.trim();
    if (!name) return;
    state.currentUser = name;
    localStorage.setItem(LS_USER, name);
    updateUserBadge();
    const banner = document.getElementById('username-banner');
    if (banner) banner.style.display = 'none';
    showToast(`Willkommen, ${name}!`, true);
  });

  document.getElementById('username-banner-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('username-banner-save')?.click();
  });

  document.getElementById('user-badge')?.addEventListener('click', e => {
    e.stopPropagation();
    const popover = document.getElementById('user-popover');
    if (!popover) return;
    const inp = document.getElementById('user-popover-input');
    if (inp) inp.value = state.currentUser;
    popover.style.display = (popover.style.display === 'none' || !popover.style.display) ? 'block' : 'none';
  });

  document.getElementById('user-popover-save')?.addEventListener('click', () => {
    const inp = document.getElementById('user-popover-input');
    if (!inp) return;
    const newName = inp.value.trim() || state.currentUser;
    state.currentUser = newName;
    localStorage.setItem(LS_USER, newName);
    updateUserBadge();
    const popover = document.getElementById('user-popover');
    if (popover) popover.style.display = 'none';
    const banner = document.getElementById('username-banner');
    if (banner) banner.style.display = 'none';
    showToast(`Benutzer: ${newName}`, true);
  });

  document.getElementById('user-popover-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('user-popover-save')?.click();
    if (e.key === 'Escape') { const p = document.getElementById('user-popover'); if (p) p.style.display = 'none'; }
  });

  document.addEventListener('click', e => {
    const popover = document.getElementById('user-popover');
    const badge   = document.getElementById('user-badge');
    if (!popover || !badge) return;
    if (!badge.contains(e.target) && !popover.contains(e.target)) popover.style.display = 'none';
  });
}

// ── Audit-Modal ───────────────────────────────────────────────────────────
const auditModal = document.getElementById('audit-modal');

function formatTs(isoStr) {
  try {
    const d = new Date(isoStr);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch { return isoStr; }
}

export function renderAuditTable() {
  const search = (document.getElementById('audit-search')?.value || '').toLowerCase();
  const filter =  document.getElementById('audit-action-filter')?.value || '';
  const tbody  =  document.getElementById('audit-tbody');
  if (!tbody) return;

  let entries = auditLog;
  if (search) entries = entries.filter(e => e.action.toLowerCase().includes(search) || e.details.toLowerCase().includes(search) || e.user.toLowerCase().includes(search));
  if (filter) entries = entries.filter(e => e.action === filter);

  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-gray-500">Noch keine Einträge</td></tr>`;
    return;
  }
  tbody.innerHTML = entries.map((e, i) => `
    <tr class="${i%2===0?'bg-[#1e1e1e]':'bg-[#232323]'} hover:bg-[#2a2a2a] transition text-sm">
      <td class="px-4 py-2 text-gray-400 whitespace-nowrap">${formatTs(e.ts)}</td>
      <td class="px-4 py-2 text-[#13d38e]">${escHtml(e.user)}</td>
      <td class="px-4 py-2 text-white">${escHtml(e.action)}</td>
      <td class="px-4 py-2 text-gray-400">${escHtml(e.details)}</td>
    </tr>`).join('');
}

function buildAuditActionOptions() {
  const select = document.getElementById('audit-action-filter');
  if (!select) return;
  const actions = [...new Set(auditLog.map(e => e.action))].sort();
  while (select.options.length > 1) select.remove(1);
  actions.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; select.appendChild(o); });
}

function exportAuditCSV() {
  const search = (document.getElementById('audit-search')?.value || '').toLowerCase();
  const filter =  document.getElementById('audit-action-filter')?.value || '';
  let entries = auditLog;
  if (search) entries = entries.filter(e => e.action.toLowerCase().includes(search) || e.details.toLowerCase().includes(search) || e.user.toLowerCase().includes(search));
  if (filter) entries = entries.filter(e => e.action === filter);
  const header = 'Zeitpunkt;Benutzer;Aktion;Details\n';
  const rows   = entries.map(e => `"${formatTs(e.ts)}";"${e.user}";"${e.action}";"${e.details.replace(/"/g,'""')}"`).join('\n');
  const blob   = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `audit_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function initAuditUI() {
  document.getElementById('btn-audit')?.addEventListener('click', () => {
    buildAuditActionOptions();
    auditModal.classList.add('open');
    lucide.createIcons();
    renderAuditTable();
  });
  document.getElementById('audit-close')?.addEventListener('click', () => auditModal.classList.remove('open'));
  auditModal?.addEventListener('click', e => { if (e.target === auditModal) auditModal.classList.remove('open'); });
  document.getElementById('audit-search')?.addEventListener('input', renderAuditTable);
  document.getElementById('audit-action-filter')?.addEventListener('change', renderAuditTable);
  document.getElementById('audit-export-csv')?.addEventListener('click', exportAuditCSV);
}

// ── Preview ────────────────────────────────────────────────────────────────
const previewModal = document.getElementById('preview-modal');

export function initPreviewUI() {
  document.getElementById('btn-preview')?.addEventListener('click', () => {
    previewModal.classList.add('open');
    lucide.createIcons();
    _loadPreview();
  });
  document.getElementById('preview-close')?.addEventListener('click', () => previewModal.classList.remove('open'));
  previewModal?.addEventListener('click', e => { if (e.target === previewModal) previewModal.classList.remove('open'); });
}

async function _loadPreview() {
  const body = document.getElementById('preview-body');
  body.innerHTML = '<div class="text-gray-500">Lade Vorschau…</div>';
  let states = null;
  try {
    const r = await fetch('/bi/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes: graphState.nodes, edges: graphState.edges })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    states = (await r.json()).states;
  } catch {
    const mock = ['OK','OK','WARNING','CRITICAL','UNKNOWN'];
    states = graphState.nodes.map((n,i) => {
      const st = mock[i % mock.length];
      return { node_id: n.id, label: n.label, state: st,
        reason: st==='OK'?'All checks passing':st==='WARNING'?'Response time elevated':st==='CRITICAL'?'Service unreachable':'No data' };
    });
  }
  if (!states?.length) { body.innerHTML = '<div class="text-gray-500">Keine Daten verfügbar.</div>'; return; }
  body.innerHTML = `
    <table class="w-full text-sm">
      <thead><tr class="border-b border-[#3a3a3a] text-gray-400 text-xs uppercase tracking-wide">
        <th class="px-4 py-2 text-left">ID</th><th class="px-4 py-2 text-left">Label</th>
        <th class="px-4 py-2 text-left">State</th><th class="px-4 py-2 text-left">Reason</th>
      </tr></thead>
      <tbody>${states.map(s => `
        <tr class="border-b border-[#2a2a2a] hover:bg-[#2a2a2a] transition">
          <td class="px-4 py-2 text-gray-300">#${s.node_id}</td>
          <td class="px-4 py-2 text-white font-medium">${escHtml(s.label)}</td>
          <td class="px-4 py-2"><span class="state-${s.state} px-2 py-0.5 rounded text-xs font-bold">${s.state}</span></td>
          <td class="px-4 py-2 text-gray-400 text-xs">${escHtml(s.reason||'')}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}
