// main.js – angepasst an dunklen NagVis-Style (moderner Tailwind/Shadcn-Look)
// Statusfarben kommen jetzt aus CSS :root Variablen

const SVG_NS = 'http://www.w3.org/2000/svg';

const state = {
  currentRule: null,
  selection: { nodes: new Set(), edges: new Set() },
  history: { past: [], future: [] },
  settings: { gridSize: 16, snap: true, zoom: 1 },
  mode: null, // 'new-node' | 'new-edge' | null
  drag: null,
  temp: {}
};

const el = {
  canvas: document.getElementById('canvas'),
  btnNewNode: document.getElementById('btn-new-node'),
  btnNewEdge: document.getElementById('btn-new-edge'),
  btnDelete: document.getElementById('btn-delete'),
  btnUndo: document.getElementById('btn-undo'),
  btnRedo: document.getElementById('btn-redo'),
  btnSave: document.getElementById('btn-save'),
  btnImport: document.getElementById('btn-import'),
  btnExport: document.getElementById('btn-export'),
  ruleTitle: document.getElementById('rule-title'),
  ruleDesc: document.getElementById('rule-desc'),
  inspector: document.getElementById('inspector'),
  inspectorEmpty: document.getElementById('inspector-empty'),
  propLabel: document.getElementById('prop-label'),
  propSelector: document.getElementById('prop-selector'),
  propStatus: document.getElementById('prop-status'),     // ← NEU: Status-Dropdown
  propColor: document.getElementById('prop-color'),
  propApply: document.getElementById('prop-apply'),
  propCancel: document.getElementById('prop-cancel'),
  status: document.getElementById('status'),
  fileInput: document.getElementById('file-input')
};

function setStatus(s) { el.status.textContent = s; }
function uid(prefix = 'n') { return prefix + '-' + Math.random().toString(36).slice(2, 9); }

// Hilfsfunktion: CSS-Variable holen (Dark-Mode-kompatibel)
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// --- Renderer ---
function clearCanvas() {
  while (el.canvas.firstChild) el.canvas.removeChild(el.canvas.firstChild);

  const defs = document.createElementNS(SVG_NS, 'defs');
  defs.innerHTML = `
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill="${getCSSVar('--muted')}"></path>
    </marker>
  `;
  el.canvas.appendChild(defs);

  ['grid', 'edges', 'nodes', 'overlay'].forEach(id => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('id', id);
    el.canvas.appendChild(g);
  });
}

function renderAll() {
  clearCanvas();
  renderGrid();
  if (!state.currentRule) return;
  renderEdges();
  renderNodes();
  renderSelection();
}

function renderGrid() {
  const g = el.canvas.querySelector('#grid');
  const gs = state.settings.gridSize;
  const w = el.canvas.clientWidth, h = el.canvas.clientHeight;
  let lines = '';
  for (let x = 0; x < w; x += gs) {
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${getCSSVar('--grid')}" stroke-width="1"/>`;
  }
  for (let y = 0; y < h; y += gs) {
    lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${getCSSVar('--grid')}" stroke-width="1"/>`;
  }
  g.innerHTML = lines;
}

function getStatusStyle(status = 'unknown') {
  const s = status.toLowerCase();
  if (s === 'ok')       return { fill: getCSSVar('--status-ok-bg'),       stroke: getCSSVar('--status-ok'),       strokeWidth: '2' };
  if (s === 'warning')  return { fill: getCSSVar('--status-warning-bg'),  stroke: getCSSVar('--status-warning'),  strokeWidth: '2' };
  if (s === 'critical') return { fill: getCSSVar('--status-critical-bg'), stroke: getCSSVar('--status-critical'), strokeWidth: '2.4' };
  if (s === 'downtime') return { fill: getCSSVar('--status-downtime-bg'), stroke: getCSSVar('--status-downtime'), strokeWidth: '2' };
  // fallback unknown
  return { fill: getCSSVar('--status-unknown-bg'), stroke: getCSSVar('--status-unknown'), strokeWidth: '1.6' };
}

function renderNodes() {
  const g = el.canvas.querySelector('#nodes');
  state.currentRule.nodes.forEach(node => {
    const ng = document.createElementNS(SVG_NS, 'g');
    ng.classList.add('node');
    ng.dataset.id = node.id;

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', node.x);
    rect.setAttribute('y', node.y);
    rect.setAttribute('width', node.w);
    rect.setAttribute('height', node.h);
    rect.setAttribute('rx', 6);

    const style = getStatusStyle(node.status);
    rect.setAttribute('fill', node.color || style.fill || getCSSVar('--node-fill'));
    rect.setAttribute('stroke', style.stroke || getCSSVar('--node-stroke'));
    rect.setAttribute('stroke-width', style.strokeWidth || '1.4');

    // Optional: leichter Glow bei critical
    if (node.status === 'critical') {
      rect.setAttribute('filter', 'drop-shadow(0 0 6px rgba(248,113,113,0.6))');
    }

    ng.appendChild(rect);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', node.x + 10);
    text.setAttribute('y', node.y + 26);
    text.textContent = node.label || node.id.slice(0,8);
    text.setAttribute('fill', getCSSVar('--text'));
    ng.appendChild(text);

    // Ports
    ['top', 'right', 'bottom', 'left'].forEach(side => {
      const p = portPosition(node, side);
      const port = document.createElementNS(SVG_NS, 'circle');
      port.classList.add('port', side);
      port.setAttribute('cx', p.x);
      port.setAttribute('cy', p.y);
      port.setAttribute('r', 4.5);
      port.setAttribute('fill', getCSSVar('--surface'));
      port.setAttribute('stroke', getCSSVar('--muted'));
      ng.appendChild(port);
    });

    ng.addEventListener('mousedown', nodeMouseDown);
    ng.addEventListener('dblclick', nodeDblClick);
    g.appendChild(ng);
  });
}

function renderEdges() {
  const g = el.canvas.querySelector('#edges');
  state.currentRule.edges.forEach(edge => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.classList.add('edge');
    path.dataset.id = edge.id;
    const s = getNode(edge.sourceId), t = getNode(edge.targetId);
    if (!s || !t) return;
    const d = buildEdgePath(s, t, edge.waypoints || []);
    path.setAttribute('d', d);
    path.setAttribute('stroke', getCSSVar('--muted'));
    path.addEventListener('mousedown', edgeMouseDown);
    g.appendChild(path);
  });
}

function renderSelection() {
  el.canvas.querySelectorAll('.node').forEach(nEl => {
    const id = nEl.dataset.id;
    nEl.classList.toggle('selected', state.selection.nodes.has(id));
  });
  el.canvas.querySelectorAll('.edge').forEach(eEl => {
    const id = eEl.dataset.id;
    eEl.classList.toggle('selected', state.selection.edges.has(id));
  });
}

// Geometry helpers (unverändert, aber konsistenter)
function getNode(id) { return state.currentRule?.nodes.find(n => n.id === id); }
function portPosition(node, side) {
  const halfW = node.w / 2, halfH = node.h / 2;
  if (side === 'top')    return { x: node.x + halfW, y: node.y };
  if (side === 'right')  return { x: node.x + node.w, y: node.y + halfH };
  if (side === 'bottom') return { x: node.x + halfW, y: node.y + node.h };
  return { x: node.x, y: node.y + halfH }; // left
}
function buildEdgePath(s, t, waypoints) {
  const sx = s.x + s.w / 2, sy = s.y + s.h / 2;
  const tx = t.x + t.w / 2, ty = t.y + t.h / 2;
  if (!waypoints?.length) {
    const cx1 = sx + (tx - sx) * 0.35, cy1 = sy;
    const cx2 = sx + (tx - sx) * 0.65, cy2 = ty;
    return `M${sx},${sy} C${cx1},${cy1} ${cx2},${cy2} ${tx},${ty}`;
  }
  let d = `M${sx},${sy}`;
  waypoints.forEach(p => d += ` L${p.x},${p.y}`);
  d += ` L${tx},${ty}`;
  return d;
}

// --- Interaction handlers (gekürzt, aber funktional) ---
function nodeMouseDown(ev) {
  ev.stopPropagation();
  const id = ev.currentTarget.dataset.id;
  const node = getNode(id);
  state.drag = { type: 'node', id, startX: ev.clientX, startY: ev.clientY, origX: node.x, origY: node.y };
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function nodeDblClick(ev) {
  ev.stopPropagation();
  const id = ev.currentTarget.dataset.id;
  selectOnlyNode(id);
  openInspectorForNode(getNode(id));
}

function edgeMouseDown(ev) {
  ev.stopPropagation();
  toggleSelectionEdge(ev.currentTarget.dataset.id);
}

function onMouseMove(ev) {
  if (!state.drag?.type === 'node') return;
  const node = getNode(state.drag.id);
  let dx = (ev.clientX - state.drag.startX) / state.settings.zoom;
  let dy = (ev.clientY - state.drag.startY) / state.settings.zoom;
  let nx = state.drag.origX + dx, ny = state.drag.origY + dy;
  if (state.settings.snap) {
    nx = Math.round(nx / state.settings.gridSize) * state.settings.gridSize;
    ny = Math.round(ny / state.settings.gridSize) * state.settings.gridSize;
  }
  node.x = nx; node.y = ny;
  renderAll();
}

function onMouseUp() {
  if (state.drag?.type === 'node') {
    // History push hier möglich
  }
  state.drag = null;
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
}

// Selection & Inspector
function selectOnlyNode(id) {
  state.selection.nodes.clear(); state.selection.edges.clear();
  state.selection.nodes.add(id);
  renderAll();
  openInspectorForNode(getNode(id));
}

function toggleSelectionEdge(id) {
  state.selection.edges.has(id) ? state.selection.edges.delete(id) : state.selection.edges.add(id);
  renderAll();
}

function clearSelection() {
  state.selection.nodes.clear();
  state.selection.edges.clear();
  hideInspector();
}

function openInspectorForNode(node) {
  if (!node) return;
  el.inspector.classList.remove('hidden');
  el.inspectorEmpty.classList.add('hidden');
  el.propLabel.value = node.label || '';
  el.propSelector.value = node.selector || '';
  el.propStatus.value = node.status || 'unknown';
  el.propColor.value = node.color || '';
}

function hideInspector() {
  el.inspector.classList.add('hidden');
  el.inspectorEmpty.classList.remove('hidden');
}

el.propApply.addEventListener('click', () => {
  const id = el.temp.inspectorNode; // du musst das noch setzen, z. B. in openInspectorForNode: el.temp.inspectorNode = node.id;
  if (!id) return;
  const node = getNode(id);
  node.label   = el.propLabel.value   || node.label;
  node.selector = el.propSelector.value || node.selector;
  node.status  = el.propStatus.value  || node.status;
  node.color   = el.propColor.value   || node.color;
  renderAll();
  hideInspector();
});

el.propCancel.addEventListener('click', hideInspector);

// Toolbar & Events (gekürzt – erweitere bei Bedarf)
el.btnNewNode.addEventListener('click', () => { state.mode = 'new-node'; setStatus('Klicke auf Canvas für neuen Node'); });
el.canvas.addEventListener('click', ev => {
  if (state.mode !== 'new-node') return;
  const rect = el.canvas.getBoundingClientRect();
  const x = Math.round((ev.clientX - rect.left) / state.settings.gridSize) * state.settings.gridSize;
  const y = Math.round((ev.clientY - rect.top) / state.settings.gridSize) * state.settings.gridSize;
  const node = {
    id: uid(),
    label: 'Neuer Host/Service',
    x, y, w: 160, h: 56,
    status: 'unknown',           // ← Default-Status
    color: '',                   // leer → CSS übernimmt
  };
  state.currentRule.nodes.push(node);
  state.mode = null;
  renderAll();
});

// Init
window.addEventListener('load', () => {
  // loadInitial() ... (dein MockBackend)
  renderAll();
  setStatus('Bereit – Dark NagVis Style aktiv');
});