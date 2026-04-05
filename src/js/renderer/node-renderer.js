import { graphState, state, multiSelect, canvas } from '../core/state.js';
import { aggregatorTypes } from '../core/constants.js';
import { pushHistory, selectNode, selectEdge, toggleMultiSelect,
         clearNodeHighlights, enterConnectMode, logAudit, exitConnectMode,
         deleteSelected } from '../core/actions.js';
import { scheduleRedrawEdges } from './renderer.js';
import { edgeSvg } from './edge-renderer.js';
import { getPortPoint } from '../utils/geometry.js';
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
  if (node.type === 'bi')         el.style.borderStyle = 'dashed';

  el.innerHTML = `
    <i data-lucide="${node.icon}" class="w-6 h-6 mb-1.5"></i>
    <div class="font-semibold node-label">${node.label}</div>
    ${node.aggType ? `<div class="text-xs opacity-80 mt-0.5 node-aggtype">(${node.aggType.toUpperCase()})</div>` : ''}
    ${node.params?.length ? `<div class="text-xs opacity-60 mt-0.5 node-params font-mono">(${node.params.map(p=>'$'+p+'$').join(', ')})</div>` : ''}
    ${node.meta?.biRef ? `<div class="text-xs opacity-70 mt-0.5 node-biref">↗ ${node.meta.biRef}</div>` : ''}
    ${node.meta?.hostRegex ? `<div class="text-xs opacity-60 mt-0.5 node-regex font-mono">${node.meta.hostRegex}${node.meta?.serviceRegex ? ' / ' + node.meta.serviceRegex : ''}</div>` : ''}
  `;

  // ── Port-Dots ──────────────────────────────────────────────────────────
  ['top', 'right', 'bottom', 'left'].forEach(port => {
    const dot = document.createElement('div');
    dot.className       = 'port-dot';
    dot.dataset.port    = port;
    dot.dataset.nodeId  = node.id;
    dot.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      _startPortDrag(e, node, port);
    });
    el.appendChild(dot);
  });

  el.addEventListener('click', e => {
    e.stopPropagation();
    if (state.connectingFrom !== null) {
      if (state.connectingFrom !== node.id) {
        const exists = graphState.edges.some(ex => ex.from === state.connectingFrom && ex.to === node.id);
        if (!exists) {
          pushHistory();
          graphState.edges.push({ id: `e${Date.now()}`, from: state.connectingFrom, to: node.id, routing: 'straight', arrowStyle: 'none', arrowSize: 'sm' });
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
    const layer = node.layerId ? graphState.layers.find(l => l.id === node.layerId) : null;
    if (layer && !layer.visible) { el.style.display = 'none'; return; }
    const inView = node.x+160 >= vp.x1 && node.x <= vp.x2 && node.y+80 >= vp.y1 && node.y <= vp.y2;
    el.style.display = inView ? '' : 'none';
  });
}

export function updateNodeEl(node) {
  const el = document.querySelector(`[data-id="${node.id}"]`);
  if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; }
}

// ── Port-Drag: Verbindung per Ziehen von Port zu Port erstellen ───────────
function _startPortDrag(startEvt, fromNode, fromPort) {
  const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  tempLine.setAttribute('stroke', '#13d38e');
  tempLine.setAttribute('stroke-width', '2');
  tempLine.setAttribute('stroke-dasharray', '6,3');
  tempLine.style.pointerEvents = 'none';
  edgeSvg.appendChild(tempLine);

  const toCanvasCoords = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - state.panX) / state.zoomLevel,
      y: (clientY - rect.top  - state.panY) / state.zoomLevel,
    };
  };

  const startPos = getPortPoint(fromNode, fromPort);
  tempLine.setAttribute('x1', startPos.x);
  tempLine.setAttribute('y1', startPos.y);
  tempLine.setAttribute('x2', startPos.x);
  tempLine.setAttribute('y2', startPos.y);

  const move = e => {
    const pos = toCanvasCoords(e.clientX, e.clientY);
    tempLine.setAttribute('x2', pos.x);
    tempLine.setAttribute('y2', pos.y);
  };

  const up = e => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup',   up);
    if (edgeSvg.contains(tempLine)) edgeSvg.removeChild(tempLine);

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const portEl = el?.classList.contains('port-dot') ? el : null;
    const nodeEl = portEl ? null : el?.closest('[data-id]');

    let toNodeId = portEl ? parseInt(portEl.dataset.nodeId, 10)
                 : nodeEl ? parseInt(nodeEl.dataset.id, 10) : null;
    const toPort = portEl?.dataset.port ?? null;

    if (!toNodeId || toNodeId === fromNode.id) return;
    const exists = graphState.edges.some(ex => ex.from === fromNode.id && ex.to === toNodeId);
    if (exists) return;

    pushHistory();
    const tn = graphState.nodes.find(n => n.id === toNodeId);
    const edgeDef = { id: `e${Date.now()}`, from: fromNode.id, to: toNodeId, routing: 'straight', fromPort, arrowStyle: 'none', arrowSize: 'sm' };
    if (toPort) edgeDef.toPort = toPort;
    graphState.edges.push(edgeDef);
    logAudit('Verbindung erstellt', `${fromNode.label} (${fromPort}) → ${tn?.label}${toPort ? ` (${toPort})` : ''}`);
    scheduleRedrawEdges();
  };

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup',   up);
}
