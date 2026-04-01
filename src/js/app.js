// ── app.js – Haupt-Einstiegspunkt ─────────────────────────────────────────
import { graphState, state, multiSelect, auditLog } from './core/state.js';
import { fullRedraw, scheduleRedrawEdges, applyTransform } from './renderer/renderer.js';
import { createNodeElement } from './renderer/node-renderer.js';
import { makeDraggable } from './interactions/drag-handler.js';
import { initConnectHandler } from './interactions/connect-handler.js';
import { initMarqueeHandler } from './interactions/marquee-handler.js';
import { initKeyboardHandler } from './interactions/keyboard-handler.js';
import { initMouseHandler } from './interactions/mouse-handler.js';
import { initToolbar } from './ui/toolbar.js';
import { initAuditUI, initPreviewUI, initUserBadge, showToast } from './ui/audit-ui.js';
import { updateUndoRedoButtons, updateInspector } from './ui/inspector.js';
import { initLayersUI } from './ui/layers-ui.js';
import { initTheme, toggleTheme } from './core/theme.js';
import { canvas } from './core/state.js';
import { initLogin } from './ui/login.js';
import { openAdminModal } from './ui/admin-ui.js';

// ── Audit-Log aus localStorage laden ─────────────────────────────────────
try {
  auditLog.push(...JSON.parse(localStorage.getItem('bi_audit') || '[]'));
} catch { /* ignorieren */ }

// ── Demo-Graph ────────────────────────────────────────────────────────────
function loadDemoGraph() {
  const demo = [
    { id: 1, type: 'host',       label: 'web-prod-01', x: 320, y: 280, color: '#A5D6A7', icon: 'server'                          },
    { id: 2, type: 'aggregator', label: 'Frontend',    x: 620, y: 220, color: '#13d38e', icon: 'git-merge', aggType: 'best'      },
    { id: 3, type: 'service',    label: 'HTTP Check',  x: 380, y: 420, color: '#90A4AE', icon: 'activity'                        },
    { id: 4, type: 'aggregator', label: 'Core',        x: 880, y: 300, color: '#13d38e', icon: 'git-merge', aggType: 'and'       },
  ];
  graphState.nextId = 5;
  demo.forEach(node => {
    graphState.nodes.push(node);
    const el = createNodeElement(node);
    canvas.appendChild(el);
    makeDraggable(el);
  });
  graphState.edges.push(
    { id: 'e1', from: 1, to: 2, routing: 'straight' },
    { id: 'e2', from: 3, to: 2, routing: 'straight' },
    { id: 'e3', from: 2, to: 4, routing: 'straight' },
  );
  scheduleRedrawEdges();
  lucide.createIcons();
}

// ── Init ──────────────────────────────────────────────────────────────────
async function init() {
  // Interaktionen & UI verdrahten
  initMouseHandler();
  initMarqueeHandler();
  initConnectHandler();
  initKeyboardHandler();
  initToolbar();
  initAuditUI();
  initPreviewUI();
  initUserBadge();
  initLayersUI();
  initTheme();
  document.getElementById('btn-theme')?.addEventListener('click', toggleTheme);
  document.getElementById('btn-admin')?.addEventListener('click', openAdminModal);

  // Auth initialisieren (zeigt Login-Modal wenn nötig)
  await initLogin();

  updateUndoRedoButtons();
  const zd = document.getElementById('zoom-level');
  if (zd) zd.textContent = '100%';

  // Gespeicherten Graphen laden oder Demo starten
  const saved = localStorage.getItem('bi_graph');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.nodes?.length) {
        graphState.nodes  = data.nodes;
        graphState.edges  = data.edges;
        graphState.nextId = Math.max(0, ...data.nodes.map(n => n.id ?? 0)) + 1;
        fullRedraw();
        showToast('Graph aus lokalem Speicher geladen', true);
        updateUndoRedoButtons();
        return;
      }
    } catch { /* ignorieren */ }
  }
  loadDemoGraph();
}

init();
