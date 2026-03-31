import { graphState, state, multiSelect, canvas } from '../core/state.js';
import { aggregatorTypes } from '../core/constants.js';
import { pushHistory, selectNode, selectEdge, toggleMultiSelect,
         clearNodeHighlights, enterConnectMode, logAudit, exitConnectMode,
         deleteSelected } from '../core/actions.js';
import { scheduleRedrawEdges } from './renderer.js';
import { openNodeCtxMenu } from '../ui/context-menu.js';

// ── DOM-Pool ──────────────────────────────────────────────────────────────
const _pool = [];

export function acquireNodeEl() {
  return _pool.pop() || document.createElement('div');
}

export function releaseNodeEl(el) {
  el.style.display = 'none';
  el.className     = '';
  el.innerHTML     = '';
  el.dataset.id    = '';
  const fresh = el.cloneNode(false);
  canvas.contains(el) && canvas.removeChild(el);
  _pool.push(fresh);
}

// ── Node-Element erstellen ────────────────────────────────────────────────
export function createNodeElement(node) {
  const el = acquireNodeEl();
  el.className = `
    absolute px-4 py-3 rounded-lg shadow-lg cursor-move select-none
    border-2 flex flex-col items-center justify-center text-center
    min-w-[140px] min-h-[50px] text-sm font-medium transition-all duration-150
  `;
  el.style.backgroundColor = `${node.color}15`;
  el.style.borderColor     = node.color;
  el.style.color           = '#ffffff';
  el.style.left            = node.x + 'px';
  el.style.top             = node.y + 'px';
  el.style.display         = '';
  el.dataset.id            = node.id;
  el.draggable             = true;

  if (node.type === 'aggregator') el.classList.add('rounded-2xl', 'font-semibold');

  el.innerHTML = `
    <i data-lucide="${node.icon}" class="w-6 h-6 mb-1.5"></i>
    <div class="font-semibold node-label">${node.label}</div>
    ${node.aggType ? `<div class="text-xs opacity-80 mt-0.5 node-aggtype">(${node.aggType.toUpperCase()})</div>` : ''}
  `;

  el.addEventListener('click', e => {
    e.stopPropagation();
    if (state.connectingFrom !== null) {
      if (state.connectingFrom !== node.id) {
        const exists = graphState.edges.some(ex => ex.from === state.connectingFrom && ex.to === node.id);
        if (!exists) {
          pushHistory();
          graphState.edges.push({ id: `e${Date.now()}`, from: state.connectingFrom, to: node.id, routing: 'straight' });
          const fn = graphState.nodes.find(n => n.id === state.connectingFrom);
          logAudit('Verbindung erstellt', `${fn?.label ?? state.connectingFrom} → ${node.label}`);
          scheduleRedrawEdges();
        }
        exitConnectMode();
      }
      return;
    }
    if (e.shiftKey) {
      toggleMultiSelect(node.id);
    } else {
      multiSelect.clear();
      clearNodeHighlights();
      selectEdge(null);
      selectNode(node.id);
    }
  });

  el.addEventListener('dblclick', e => { e.stopPropagation(); startInlineEdit(el, node); });

  el.addEventListener('mouseenter', () => {
    if (state.connectingFrom !== null && state.connectingFrom !== node.id)
      el.classList.add('ring-2','ring-green-400','ring-offset-2','ring-offset-[#1a1a1a]','scale-105');
  });
  el.addEventListener('mouseleave', () => {
    if (state.connectingFrom !== null)
      el.classList.remove('ring-2','ring-green-400','ring-offset-2','ring-offset-[#1a1a1a]','scale-105');
  });

  el.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    if (!multiSelect.has(node.id)) selectNode(node.id);
    openNodeCtxMenu(node, e.clientX, e.clientY);
  });

  return el;
}

// ── Inline-Edit ───────────────────────────────────────────────────────────
export function startInlineEdit(el, node) {
  const labelEl = el.querySelector('.node-label');
  if (!labelEl) return;
  const oldLabel = node.label;
  const input = document.createElement('input');
  input.type      = 'text';
  input.value     = node.label;
  input.className = 'bg-[#1a1a1a] border border-[#13d38e] rounded px-1 py-0.5 text-white text-sm text-center w-full outline-none';
  input.style.minWidth = '80px';
  labelEl.replaceWith(input);
  input.focus(); input.select();

  const save = () => {
    const newLabel = input.value.trim() || node.label;
    pushHistory();
    if (newLabel !== oldLabel) logAudit('Label geändert', `"${oldLabel}" → "${newLabel}"`);
    node.label = newLabel;
    const div = document.createElement('div');
    div.className   = 'font-semibold node-label';
    div.textContent = newLabel;
    input.replaceWith(div);
    const inp = document.getElementById('inp-label');
    if (inp && state.selectedNode?.id === node.id) inp.value = newLabel;
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') {
      const orig = document.createElement('div');
      orig.className   = 'font-semibold node-label';
      orig.textContent = node.label;
      input.replaceWith(orig);
    }
  });
  input.addEventListener('blur', save);
}

// ── Viewport-Culling ──────────────────────────────────────────────────────
export function updateVisibility() {
  const w = document.getElementById('canvas-wrapper')?.clientWidth  || 1200;
  const h = document.getElementById('canvas-wrapper')?.clientHeight || 800;
  const vp = {
    x1: -state.panX / state.zoomLevel - 200,
    y1: -state.panY / state.zoomLevel - 200,
    x2: (-state.panX + w) / state.zoomLevel + 200,
    y2: (-state.panY + h) / state.zoomLevel + 200,
  };
  graphState.nodes.forEach(node => {
    const el = document.querySelector(`[data-id="${node.id}"]`);
    if (!el) return;
    const inView = node.x+160 >= vp.x1 && node.x <= vp.x2 && node.y+80 >= vp.y1 && node.y <= vp.y2;
    el.style.display = inView ? '' : 'none';
  });
}

export function updateNodeEl(node) {
  const el = document.querySelector(`[data-id="${node.id}"]`);
  if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; }
}
