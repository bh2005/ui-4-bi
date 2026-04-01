// ── theme.js ──────────────────────────────────────────────────────────────
const LS_KEY = 'bi_theme';

export function initTheme() {
  if (localStorage.getItem(LS_KEY) === 'light') {
    document.documentElement.classList.add('light');
  }
  _updateBtn();
}

export function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem(LS_KEY, isLight ? 'light' : 'dark');
  _updateBtn();
}

function _updateBtn() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  const isLight = document.documentElement.classList.contains('light');
  btn.title = isLight ? 'Dark Mode aktivieren' : 'Light Mode aktivieren';
  btn.innerHTML = `<i data-lucide="${isLight ? 'moon' : 'sun'}" class="w-4 h-4"></i>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
