// main.js – CMK BI Visual Editor (Phase 1 + 2)
// Features: Undo/Redo, Multi-Select, Inline Edit, Align/Distribute,
//           Waypoint Editing, Grid Snap, Snaplines, Preview, Save/Validate, Import/Export

// ── State ──────────────────────────────────────────────────────────────────
const graphState = {
  nodes: [],
  edges: [],
  nextId: 1
};

// History für Undo/Redo
const history = {
  past:   [],
  future: []
};

let selectedNode   = null;
let selectedEdge   = null;
let connectingFrom = null;
let zoomLevel      = 1;
let panX           = 0;
let panY           = 0;
let isPanning      = false;
let panStartX, panStartY;
let snap           = true; // Grid-Snap default ON

// Multi-Select
const multiSelect = new Set(); // stores node IDs

// Waypoint dragging state
let draggingWP = null; // { edgeId, index, isNew }

const canvas         = document.getElementById('canvas');
const canvasWrapper  = document.getElementById('canvas-wrapper');
const inspector      = document.getElementById('inspector');
const noSelection    = document.getElementById('no-selection');
const zoomDisplay    = document.getElementById('zoom-level');
const marqueeEl      = document.getElementById('marquee');
const snaplineLayer  = document.getElementById('snapline-layer');

// ── Node/Aggregator-Typen ──────────────────────────────────────────────────
const aggregatorTypes = [
  { value: 'and',        label: 'AND (alle müssen OK sein)' },
  { value: 'or',         label: 'OR (mindestens einer OK)'  },
  { value: 'best',       label: 'Best state'                },
  { value: 'worst',      label: 'Worst state'               },
  { value: 'best_of_n',  label: 'Best of N'                 },
  { value: 'worst_of_n', label: 'Worst of N'                }
];

const nodeTypes = [
  { type: 'aggregator', label: 'BI Aggregator',  color: '#13d38e', icon: 'git-merge' },
  { type: 'host',       label: 'Host (Process)', color: '#A5D6A7', icon: 'server'    },
  { type: 'service',    label: 'Service',        color: '#90A4AE', icon: 'activity'  }
];

// ── Grid Snap Helper ───────────────────────────────────────────────────────
function snapToGrid(v) {
  return snap ? Math.round(v / 20) * 20 : v;
}

// ── History / Undo / Redo ──────────────────────────────────────────────────
function snapshot() {
  return JSON.stringify({ nodes: graphState.nodes, edges: graphState.edges, nextId: graphState.nextId });
}

function pushHistory() {
  history.past.push(snapshot());
  history.future = [];
  if (history.past.length > 100) history.past.shift();
  updateUndoRedoButtons();
}

function restoreSnapshot(snap) {
  const s = JSON.parse(snap);
  graphState.nodes  = s.nodes;
  graphState.edges  = s.edges;
  graphState.nextId = s.nextId;
  selectedNode = null;
  selectedEdge = null;
  multiSelect.clear();
  fullRedraw();
  updateInspector();
}

function undo() {
  if (!history.past.length) return;
  history.future.push(snapshot());
  restoreSnapshot(history.past.pop());
  updateUndoRedoButtons();
}

function redo() {
  if (!history.future.length) return;
  history.past.push(snapshot());
  restoreSnapshot(history.future.pop());
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = history.past.length === 0;
  if (r) r.disabled = history.future.length === 0;
}

// ── Edge-Punkt-Berechnung ──────────────────────────────────────────────────
function getEdgePoint(node, targetNode) {
  const nw = 140, nh = 50;
  const dx = targetNode.x - node.x;
  const dy = targetNode.y - node.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { x: node.x + nw,     y: node.y + nh / 2 }
      : { x: node.x,           y: node.y + nh / 2 };
  } else {
    return dy > 0
      ? { x: node.x + nw / 2, y: node.y + nh }
      : { x: node.x + nw / 2, y: node.y };
  }
}

// ── Bézier Punkt bei t ─────────────────────────────────────────────────────
function bezierPoint(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  return {
    x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
    y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y
  };
}

// ── Node DOM-Element erstellen ─────────────────────────────────────────────
function createNodeElement(node) {
  const el = document.createElement('div');
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
  el.dataset.id            = node.id;
  el.draggable             = true;

  if (node.type === 'aggregator') el.classList.add('rounded-2xl', 'font-semibold');

  el.innerHTML = `
    <i data-lucide="${node.icon}" class="w-6 h-6 mb-1.5"></i>
    <div class="font-semibold node-label">${node.label}</div>
    ${node.aggType ? `<div class="text-xs opacity-80 mt-0.5 node-aggtype">(${node.aggType.toUpperCase()})</div>` : ''}
  `;

  // Click handler
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (connectingFrom !== null) {
      if (connectingFrom !== node.id) {
        const exists = graphState.edges.some(
          ex => ex.from === connectingFrom && ex.to === node.id
        );
        if (!exists) {
          pushHistory();
          graphState.edges.push({ id: `e${Date.now()}`, from: connectingFrom, to: node.id });
          redrawEdges();
        }
        exitConnectMode();
      }
      return;
    }
    if (e.shiftKey) {
      // Multi-Select: toggle
      toggleMultiSelect(node.id);
    } else {
      multiSelect.clear();
      clearNodeHighlights();
      selectEdge(null);
      selectNode(node.id);
    }
  });

  // Double-click: Inline Edit
  el.addEventListener('dblclick', e => {
    e.stopPropagation();
    startInlineEdit(el, node);
  });

  el.addEventListener('mouseenter', () => {
    if (connectingFrom !== null && connectingFrom !== node.id)
      el.classList.add('ring-2', 'ring-green-400', 'ring-offset-2', 'ring-offset-[#1a1a1a]', 'scale-105');
  });
  el.addEventListener('mouseleave', () => {
    if (connectingFrom !== null)
      el.classList.remove('ring-2', 'ring-green-400', 'ring-offset-2', 'ring-offset-[#1a1a1a]', 'scale-105');
  });

  return el;
}

// ── Inline Edit ────────────────────────────────────────────────────────────
function startInlineEdit(el, node) {
  const labelEl = el.querySelector('.node-label');
  if (!labelEl) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = node.label;
  input.className = 'bg-[#1a1a1a] border border-[#13d38e] rounded px-1 py-0.5 text-white text-sm text-center w-full outline-none';
  input.style.minWidth = '80px';

  // Replace label div with input
  labelEl.replaceWith(input);
  input.focus();
  input.select();

  const save = () => {
    const newLabel = input.value.trim() || node.label;
    pushHistory();
    node.label = newLabel;

    // Recreate label element
    const newLabel_el = document.createElement('div');
    newLabel_el.className = 'font-semibold node-label';
    newLabel_el.textContent = newLabel;
    input.replaceWith(newLabel_el);

    // Also sync inspector if this node is selected
    if (selectedNode?.id === node.id) {
      const inp = document.getElementById('inp-label');
      if (inp) inp.value = newLabel;
    }
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') {
      // Cancel: restore original label
      const orig = document.createElement('div');
      orig.className = 'font-semibold node-label';
      orig.textContent = node.label;
      input.replaceWith(orig);
    }
  });

  input.addEventListener('blur', save);
}

// ── Vollständiges Neuzeichnen ─────────────────────────────────────────────
function fullRedraw() {
  document.querySelectorAll('[data-id]').forEach(el => el.remove());
  document.querySelectorAll('.edge-layer').forEach(el => el.remove());

  graphState.nodes.forEach(node => {
    const el = createNodeElement(node);
    canvas.appendChild(el);
    makeDraggable(el);
  });

  redrawEdges();
  lucide.createIcons();
  applyMultiSelectHighlights();
}

// ── Multi-Select Helpers ───────────────────────────────────────────────────
function toggleMultiSelect(id) {
  if (multiSelect.has(id)) {
    multiSelect.delete(id);
  } else {
    multiSelect.add(id);
    // If there was a single selection, add it to multiSelect too
    if (selectedNode) {
      multiSelect.add(selectedNode.id);
      selectedNode = null;
    }
  }
  selectedNode = null;
  selectedEdge = null;
  applyMultiSelectHighlights();
  updateInspector();
}

function clearNodeHighlights() {
  document.querySelectorAll('[data-id]').forEach(el =>
    el.classList.remove(
      'ring-2', 'ring-white', 'ring-blue-400', 'ring-green-400',
      'ring-offset-2', 'ring-offset-[#1a1a1a]', 'animate-pulse', 'scale-105'
    )
  );
}

function applyMultiSelectHighlights() {
  clearNodeHighlights();
  multiSelect.forEach(id => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2', 'ring-offset-[#1a1a1a]');
  });
  if (selectedNode) {
    const el = document.querySelector(`[data-id="${selectedNode.id}"]`);
    if (el) el.classList.add('ring-2', 'ring-white', 'ring-offset-2', 'ring-offset-[#1a1a1a]');
  }
}

// ── Auswahl ────────────────────────────────────────────────────────────────
function selectNode(id) {
  selectedEdge = null;
  clearNodeHighlights();

  selectedNode = graphState.nodes.find(n => n.id === id) || null;
  if (!selectedNode) { updateInspector(); return; }

  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) el.classList.add('ring-2', 'ring-white', 'ring-offset-2', 'ring-offset-[#1a1a1a]');
  updateInspector();
}

function selectEdge(edgeId) {
  selectedNode = null;
  selectedEdge = edgeId ? graphState.edges.find(e => e.id === edgeId) : null;
  clearNodeHighlights();
  redrawEdges();
  updateInspector();
}

// ── Delete ─────────────────────────────────────────────────────────────────
function deleteSelected() {
  if (multiSelect.size > 0) {
    pushHistory();
    const ids = new Set(multiSelect);
    graphState.nodes = graphState.nodes.filter(n => !ids.has(n.id));
    graphState.edges = graphState.edges.filter(e => !ids.has(e.from) && !ids.has(e.to));
    multiSelect.clear();
    selectedNode = null;
    fullRedraw();
    updateInspector();
  } else if (selectedNode) {
    pushHistory();
    const id = selectedNode.id;
    graphState.nodes  = graphState.nodes.filter(n => n.id !== id);
    graphState.edges  = graphState.edges.filter(e => e.from !== id && e.to !== id);
    selectedNode = null;
    fullRedraw();
    updateInspector();
  } else if (selectedEdge) {
    pushHistory();
    const id = selectedEdge.id;
    graphState.edges = graphState.edges.filter(e => e.id !== id);
    selectedEdge = null;
    redrawEdges();
    updateInspector();
  }
}

// ── Align / Distribute ─────────────────────────────────────────────────────
function getSelectedNodes() {
  return graphState.nodes.filter(n => multiSelect.has(n.id));
}

function alignNodes(type) {
  const nodes = getSelectedNodes();
  if (nodes.length < 2) return;
  pushHistory();

  switch (type) {
    case 'left': {
      const minX = Math.min(...nodes.map(n => n.x));
      nodes.forEach(n => { n.x = minX; updateNodeEl(n); });
      break;
    }
    case 'center-h': {
      const cx = nodes.reduce((s, n) => s + n.x + 70, 0) / nodes.length;
      nodes.forEach(n => { n.x = Math.round(cx - 70); updateNodeEl(n); });
      break;
    }
    case 'right': {
      const maxX = Math.max(...nodes.map(n => n.x + 140));
      nodes.forEach(n => { n.x = maxX - 140; updateNodeEl(n); });
      break;
    }
    case 'top': {
      const minY = Math.min(...nodes.map(n => n.y));
      nodes.forEach(n => { n.y = minY; updateNodeEl(n); });
      break;
    }
    case 'middle-v': {
      const cy = nodes.reduce((s, n) => s + n.y + 25, 0) / nodes.length;
      nodes.forEach(n => { n.y = Math.round(cy - 25); updateNodeEl(n); });
      break;
    }
    case 'bottom': {
      const maxY = Math.max(...nodes.map(n => n.y + 50));
      nodes.forEach(n => { n.y = maxY - 50; updateNodeEl(n); });
      break;
    }
    case 'distribute-h': {
      const sorted = [...nodes].sort((a, b) => a.x - b.x);
      const totalSpan = sorted[sorted.length-1].x - sorted[0].x;
      const step = totalSpan / (sorted.length - 1);
      sorted.forEach((n, i) => { n.x = Math.round(sorted[0].x + i * step); updateNodeEl(n); });
      break;
    }
    case 'distribute-v': {
      const sorted = [...nodes].sort((a, b) => a.y - b.y);
      const totalSpan = sorted[sorted.length-1].y - sorted[0].y;
      const step = totalSpan / (sorted.length - 1);
      sorted.forEach((n, i) => { n.y = Math.round(sorted[0].y + i * step); updateNodeEl(n); });
      break;
    }
  }
  redrawEdges();
}

function updateNodeEl(node) {
  const el = document.querySelector(`[data-id="${node.id}"]`);
  if (el) {
    el.style.left = node.x + 'px';
    el.style.top  = node.y + 'px';
  }
}

// ── Inspector ──────────────────────────────────────────────────────────────
function updateInspector() {
  // Multi-select inspector
  if (multiSelect.size > 0) {
    inspector.classList.remove('hidden');
    noSelection.classList.add('hidden');

    const alignBtns = multiSelect.size >= 2 ? `
      <div class="mt-4">
        <label class="block text-gray-400 mb-1">Ausrichten</label>
        <div class="grid grid-cols-3 gap-1">
          <button data-align="left"        title="Links"           class="align-btn bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">⬅ L</button>
          <button data-align="center-h"    title="Mitte H"         class="align-btn bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">⬌ H</button>
          <button data-align="right"       title="Rechts"          class="align-btn bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">R ➡</button>
          <button data-align="top"         title="Oben"            class="align-btn bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">⬆ O</button>
          <button data-align="middle-v"    title="Mitte V"         class="align-btn bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">⬍ V</button>
          <button data-align="bottom"      title="Unten"           class="align-btn bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">U ⬇</button>
          <button data-align="distribute-h" title="Verteilen H"    class="align-btn col-span-3 bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">⬌⬌ Verteilen H</button>
          <button data-align="distribute-v" title="Verteilen V"    class="align-btn col-span-3 bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">⬍⬍ Verteilen V</button>
        </div>
      </div>` : '';

    inspector.innerHTML = `
      <div class="space-y-4 text-sm">
        <div class="text-white font-semibold">${multiSelect.size} Nodes ausgewählt</div>
        ${alignBtns}
        <div class="pt-2">
          <button id="btn-del-multi"
            class="w-full bg-red-700 hover:bg-red-600 text-white font-medium py-2 px-4 rounded transition">
            Alle löschen
          </button>
        </div>
      </div>`;

    document.getElementById('btn-del-multi')?.addEventListener('click', deleteSelected);
    document.querySelectorAll('.align-btn').forEach(btn => {
      btn.addEventListener('click', () => alignNodes(btn.dataset.align));
    });
    return;
  }

  if (!selectedNode && !selectedEdge) {
    inspector.classList.add('hidden');
    noSelection.classList.remove('hidden');
    return;
  }

  inspector.classList.remove('hidden');
  noSelection.classList.add('hidden');

  if (selectedEdge) {
    const fromNode = graphState.nodes.find(n => n.id === selectedEdge.from);
    const toNode   = graphState.nodes.find(n => n.id === selectedEdge.to);
    inspector.innerHTML = `
      <div class="space-y-4 text-sm">
        <div><label class="block text-gray-400 mb-1">Verbindung</label>
          <div class="text-white">${fromNode?.label ?? selectedEdge.from} → ${toNode?.label ?? selectedEdge.to}</div>
        </div>
        <div class="text-xs text-gray-500">Waypoints: ${(selectedEdge.waypoints || []).length}
          <span class="ml-1 text-gray-600">(Handles auf Kante ziehen)</span>
        </div>
        <div class="pt-2">
          <button id="btn-del-edge"
            class="w-full bg-red-700 hover:bg-red-600 text-white font-medium py-2 px-4 rounded transition">
            Verbindung löschen
          </button>
        </div>
      </div>`;
    document.getElementById('btn-del-edge')?.addEventListener('click', deleteSelected);
    return;
  }

  // Node-Inspector
  let aggSection = '';
  if (selectedNode.type === 'aggregator') {
    const cur = selectedNode.aggType || 'and';
    aggSection = `
      <div class="mt-4">
        <label class="block text-gray-400 mb-1">Aggregation-Typ</label>
        <select id="agg-type-select" class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e]">
          ${aggregatorTypes.map(o => `<option value="${o.value}" ${o.value === cur ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>`;
  }

  inspector.innerHTML = `
    <div class="space-y-4 text-sm">
      <div>
        <label class="block text-gray-400 mb-1">Label</label>
        <input type="text" id="inp-label" value="${selectedNode.label || ''}"
               class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e]">
      </div>
      <div>
        <label class="block text-gray-400 mb-1">Typ</label>
        <div class="text-white">${selectedNode.type}</div>
      </div>
      ${aggSection}
      <div class="pt-2">
        <button id="btn-connect"
          class="w-full bg-[#13d38e] hover:bg-[#0fa678] text-black font-medium py-2 px-4 rounded transition">
          Mit anderem Knoten verbinden →
        </button>
      </div>
      <div class="pt-1">
        <button id="btn-del-node"
          class="w-full bg-red-700 hover:bg-red-600 text-white font-medium py-2 px-4 rounded transition">
          Node löschen
        </button>
      </div>
      <div class="text-xs text-gray-500 mt-3">ID: #${selectedNode.id}</div>
    </div>`;

  document.getElementById('inp-label')?.addEventListener('input', e => {
    selectedNode.label = e.target.value.trim() || selectedNode.type;
    const labelEl = document.querySelector(`[data-id="${selectedNode.id}"] .node-label`);
    if (labelEl) labelEl.textContent = selectedNode.label;
  });

  document.getElementById('agg-type-select')?.addEventListener('change', e => {
    selectedNode.aggType = e.target.value;
    const nodeEl = document.querySelector(`[data-id="${selectedNode.id}"]`);
    if (nodeEl) {
      let typeLine = nodeEl.querySelector('.node-aggtype');
      if (typeLine) {
        typeLine.textContent = `(${e.target.value.toUpperCase()})`;
      } else {
        typeLine = document.createElement('div');
        typeLine.className = 'text-xs opacity-80 mt-0.5 node-aggtype';
        typeLine.textContent = `(${e.target.value.toUpperCase()})`;
        nodeEl.appendChild(typeLine);
      }
    }
  });

  document.getElementById('btn-connect')?.addEventListener('click', () => {
    if (selectedNode) enterConnectMode(selectedNode.id);
  });

  document.getElementById('btn-del-node')?.addEventListener('click', deleteSelected);
}

// ── Connect-Modus ──────────────────────────────────────────────────────────
function enterConnectMode(fromId) {
  connectingFrom = fromId;
  const fromEl = document.querySelector(`[data-id="${fromId}"]`);
  if (fromEl) fromEl.classList.add('ring-green-400', 'animate-pulse', 'ring-offset-2', 'ring-offset-[#1a1a1a]');
  canvas.style.cursor = 'crosshair';
}

function exitConnectMode() {
  connectingFrom = null;
  canvas.style.cursor = 'default';
  document.querySelectorAll('[data-id]').forEach(el =>
    el.classList.remove('ring-green-400', 'animate-pulse', 'scale-105')
  );
  if (selectedNode) selectNode(selectedNode.id);
  else applyMultiSelectHighlights();
}

// ── Drag & Drop aus Palette ────────────────────────────────────────────────
canvas.addEventListener('dragover', e => e.preventDefault());

canvas.addEventListener('drop', e => {
  e.preventDefault();
  if (connectingFrom !== null) return;
  const type = e.dataTransfer.getData('text/plain');
  if (!type) return;
  const template = nodeTypes.find(t => t.type === type);
  if (!template) return;

  const rect = canvas.getBoundingClientRect();
  const rawX = (e.clientX - rect.left - panX) / zoomLevel;
  const rawY = (e.clientY - rect.top  - panY) / zoomLevel;
  const x = snapToGrid(Math.round(rawX - 70));
  const y = snapToGrid(Math.round(rawY - 25));

  pushHistory();
  const node = {
    id:      graphState.nextId++,
    type,
    label:   template.label,
    x,
    y,
    color:   template.color,
    icon:    template.icon,
    aggType: type === 'aggregator' ? 'and' : undefined
  };

  graphState.nodes.push(node);
  const el = createNodeElement(node);
  canvas.appendChild(el);
  makeDraggable(el);
  lucide.createIcons();
});

// ── Draggable ──────────────────────────────────────────────────────────────
function makeDraggable(el) {
  el.addEventListener('mousedown', evt => {
    if (evt.button !== 0 || connectingFrom !== null) return;
    // Don't interfere with inline edit inputs
    if (evt.target.tagName === 'INPUT') return;
    evt.stopPropagation();

    const id = parseInt(el.dataset.id);

    // Shift held → let the click handler handle selection, just prep drag
    // No Shift → if node not already in multiSelect, switch to single-select
    if (!evt.shiftKey && !multiSelect.has(id)) {
      multiSelect.clear();
      clearNodeHighlights();
      selectEdge(null);
      selectNode(id);
    }

    const startX = evt.clientX;
    const startY = evt.clientY;

    // Capture initial positions: all multiSelect nodes, or just this one
    const movingIds = multiSelect.size > 0 ? [...multiSelect] : [id];
    const origPositions = {};
    movingIds.forEach(nid => {
      const node = graphState.nodes.find(n => n.id === nid);
      if (node) origPositions[nid] = { x: node.x, y: node.y };
    });

    let moved = false;

    const move = e => {
      if (!moved) { pushHistory(); moved = true; }
      const dx = (e.clientX - startX) / zoomLevel;
      const dy = (e.clientY - startY) / zoomLevel;

      // Compute new position for the dragged node (for snaplines)
      const draggedOrig = origPositions[id];
      const newDragX = snapToGrid(Math.round(draggedOrig.x + dx));
      const newDragY = snapToGrid(Math.round(draggedOrig.y + dy));

      // Snaplines: check alignment with other nodes
      const snapResult = computeSnaplines(id, newDragX, newDragY);
      const snappedDX = (snapResult.snapX !== null ? snapResult.snapX : newDragX) - draggedOrig.x;
      const snappedDY = (snapResult.snapY !== null ? snapResult.snapY : newDragY) - draggedOrig.y;

      drawSnaplines(snapResult.lines);

      movingIds.forEach(nid => {
        const node = graphState.nodes.find(n => n.id === nid);
        if (!node) return;
        const orig = origPositions[nid];
        node.x = Math.round(orig.x + snappedDX);
        node.y = Math.round(orig.y + snappedDY);
        const nodeEl = document.querySelector(`[data-id="${nid}"]`);
        if (nodeEl) {
          nodeEl.style.left = node.x + 'px';
          nodeEl.style.top  = node.y + 'px';
        }
      });

      redrawEdges();
    };

    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup',   up);
      clearSnaplines();
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup',   up);
  });
}

// ── Snaplines ─────────────────────────────────────────────────────────────
const SNAP_TOL = 8;

function computeSnaplines(draggedId, nx, ny) {
  const nw = 140, nh = 50;
  const others = graphState.nodes.filter(n => n.id !== draggedId && !multiSelect.has(n.id));
  const lines = [];
  let snapX = null, snapY = null;

  // Candidate x values of dragged node: left, center, right
  const dragXCandidates = [nx, nx + nw/2, nx + nw];
  // Candidate y values: top, middle, bottom
  const dragYCandidates = [ny, ny + nh/2, ny + nh];

  others.forEach(other => {
    // X alignment
    const otherXCandidates = [other.x, other.x + nw/2, other.x + nw];
    dragXCandidates.forEach(dxc => {
      otherXCandidates.forEach(oxc => {
        if (Math.abs(dxc - oxc) <= SNAP_TOL) {
          const offset = oxc - dxc;
          if (snapX === null) {
            snapX = nx + offset;
            lines.push({ type: 'v', x: oxc });
          }
        }
      });
    });

    // Y alignment
    const otherYCandidates = [other.y, other.y + nh/2, other.y + nh];
    dragYCandidates.forEach(dyc => {
      otherYCandidates.forEach(oyc => {
        if (Math.abs(dyc - oyc) <= SNAP_TOL) {
          const offset = oyc - dyc;
          if (snapY === null) {
            snapY = ny + offset;
            lines.push({ type: 'h', y: oyc });
          }
        }
      });
    });
  });

  return { snapX, snapY, lines };
}

function drawSnaplines(lines) {
  // Clear existing lines
  while (snaplineLayer.firstChild) snaplineLayer.removeChild(snaplineLayer.firstChild);
  if (!lines || lines.length === 0) return;

  const wrapRect = canvasWrapper.getBoundingClientRect();
  const w = wrapRect.width;
  const h = wrapRect.height;

  lines.forEach(line => {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('stroke-dasharray', '4,4');
    l.setAttribute('stroke-width', '1');
    l.setAttribute('opacity', '0.85');

    if (line.type === 'v') {
      // Vertical line at canvas x (need to convert to screen coords)
      const screenX = line.x * zoomLevel + panX + canvas.getBoundingClientRect().left - wrapRect.left;
      l.setAttribute('x1', screenX);
      l.setAttribute('y1', '0');
      l.setAttribute('x2', screenX);
      l.setAttribute('y2', h);
      l.setAttribute('stroke', '#13d38e');
    } else {
      // Horizontal line at canvas y
      const screenY = line.y * zoomLevel + panY + canvas.getBoundingClientRect().top - wrapRect.top;
      l.setAttribute('x1', '0');
      l.setAttribute('y1', screenY);
      l.setAttribute('x2', w);
      l.setAttribute('y2', screenY);
      l.setAttribute('stroke', '#e74c3c');
    }
    snaplineLayer.appendChild(l);
  });
}

function clearSnaplines() {
  while (snaplineLayer.firstChild) snaplineLayer.removeChild(snaplineLayer.firstChild);
}

// ── Marquee Selection ──────────────────────────────────────────────────────
let marqueeActive = false;
let marqueeStart  = { x: 0, y: 0 };

canvasWrapper.addEventListener('mousedown', e => {
  // Only start marquee on left-click directly on canvas/wrapper (not on nodes)
  if (e.button !== 0) return;
  if (connectingFrom !== null) return;
  if (spacePressed) return;
  if (isPanning) return;
  // Check that target is canvas background or wrapper
  const target = e.target;
  const isBackground = (
    target === canvas || target === canvasWrapper ||
    target.classList.contains('edge-layer') ||
    (target.tagName === 'svg'  && !target.classList.contains('wp-handle')) ||
    (target.tagName === 'path' && !target.dataset.edgeId)
  );
  if (!isBackground) return;

  marqueeActive = true;
  const wrapRect = canvasWrapper.getBoundingClientRect();
  marqueeStart = { x: e.clientX - wrapRect.left, y: e.clientY - wrapRect.top };

  marqueeEl.style.left   = marqueeStart.x + 'px';
  marqueeEl.style.top    = marqueeStart.y + 'px';
  marqueeEl.style.width  = '0px';
  marqueeEl.style.height = '0px';
  marqueeEl.classList.remove('hidden');
});

document.addEventListener('mousemove', e => {
  if (!marqueeActive) return;
  const wrapRect = canvasWrapper.getBoundingClientRect();
  const curX = e.clientX - wrapRect.left;
  const curY = e.clientY - wrapRect.top;

  const x = Math.min(curX, marqueeStart.x);
  const y = Math.min(curY, marqueeStart.y);
  const w = Math.abs(curX - marqueeStart.x);
  const h = Math.abs(curY - marqueeStart.y);

  marqueeEl.style.left   = x + 'px';
  marqueeEl.style.top    = y + 'px';
  marqueeEl.style.width  = w + 'px';
  marqueeEl.style.height = h + 'px';
});

document.addEventListener('mouseup', e => {
  if (!marqueeActive) return;
  marqueeActive = false;
  marqueeEl.classList.add('hidden');

  const wrapRect = canvasWrapper.getBoundingClientRect();
  const curX = e.clientX - wrapRect.left;
  const curY = e.clientY - wrapRect.top;

  const rectX1 = Math.min(curX, marqueeStart.x);
  const rectY1 = Math.min(curY, marqueeStart.y);
  const rectX2 = Math.max(curX, marqueeStart.x);
  const rectY2 = Math.max(curY, marqueeStart.y);

  // Need at least 5px drag to count as marquee
  if (rectX2 - rectX1 < 5 && rectY2 - rectY1 < 5) return;

  // Convert screen rect to canvas coords
  const canvasRect = canvas.getBoundingClientRect();
  const cx1 = (rectX1 - (canvasRect.left - wrapRect.left)) / zoomLevel;
  const cy1 = (rectY1 - (canvasRect.top  - wrapRect.top )) / zoomLevel;
  const cx2 = (rectX2 - (canvasRect.left - wrapRect.left)) / zoomLevel;
  const cy2 = (rectY2 - (canvasRect.top  - wrapRect.top )) / zoomLevel;

  multiSelect.clear();
  selectedNode = null;
  selectedEdge = null;

  graphState.nodes.forEach(node => {
    const nCx = node.x + 70;
    const nCy = node.y + 25;
    if (nCx >= cx1 && nCx <= cx2 && nCy >= cy1 && nCy <= cy2) {
      multiSelect.add(node.id);
    }
  });

  applyMultiSelectHighlights();
  updateInspector();
});

// ── Edges zeichnen (Bézier + Waypoints + klickbar) ─────────────────────────
function buildEdgePath(edge, fromNode, toNode) {
  const start = getEdgePoint(fromNode, toNode);
  const end   = getEdgePoint(toNode,   fromNode);
  const dx    = end.x - start.x;
  const dy    = end.y - start.y;
  let offset  = Math.max(40, Math.hypot(dx, dy) * 0.35);

  let cp1x = start.x, cp1y = start.y, cp2x = end.x, cp2y = end.y;
  if (Math.abs(dx) > Math.abs(dy) * 1.5) {
    cp1x = start.x + dx * 0.33; cp1y = start.y + (dy > 0 ?  offset : -offset);
    cp2x = end.x   - dx * 0.33; cp2y = end.y   + (dy > 0 ?  offset : -offset);
  } else if (Math.abs(dy) > Math.abs(dx) * 1.5) {
    cp1x = start.x + (dx > 0 ?  offset : -offset); cp1y = start.y + dy * 0.33;
    cp2x = end.x   + (dx > 0 ? -offset :  offset); cp2y = end.y   - dy * 0.33;
  } else {
    cp1x = start.x + dx * 0.4; cp1y = start.y + dy * 0.2;
    cp2x = end.x   - dx * 0.4; cp2y = end.y   - dy * 0.2;
  }

  const collides = graphState.nodes.some(n => {
    if (n.id === fromNode.id || n.id === toNode.id) return false;
    const t = ((n.x - start.x) * dx + (n.y - start.y) * dy) / (dx * dx + dy * dy);
    if (t < 0.1 || t > 0.9) return false;
    const ix = start.x + t * dx, iy = start.y + t * dy;
    return ix > n.x - 20 && ix < n.x + 160 && iy > n.y - 20 && iy < n.y + 70;
  });
  if (collides) {
    offset *= 1.6;
    cp1y += dy > 0 ? offset * 0.6 : -offset * 0.6;
    cp2y += dy > 0 ? -offset * 0.6 : offset * 0.6;
  }

  // If waypoints exist, build a path through them
  if (edge.waypoints && edge.waypoints.length > 0) {
    let d = `M ${start.x},${start.y}`;
    const pts = [start, ...edge.waypoints, end];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i+1];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (i === 0) {
        d += ` Q ${a.x},${a.y} ${mx},${my}`;
      } else if (i === pts.length - 2) {
        d += ` Q ${b.x},${b.y} ${b.x},${b.y}`;
      } else {
        d += ` Q ${a.x},${a.y} ${mx},${my}`;
      }
    }
    return { d, start, end, cp1x, cp1y, cp2x, cp2y };
  }

  const d = `M ${start.x},${start.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${end.x},${end.y}`;
  return { d, start, end, cp1x, cp1y, cp2x, cp2y };
}

function redrawEdges() {
  document.querySelectorAll('.edge-layer').forEach(el => el.remove());

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('edge-layer');
  svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;';
  canvas.appendChild(svg);

  // Arrow-Marker
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="3" orient="auto">
      <path d="M0,0 L0,6 L10,3 z" fill="#13d38e"/>
    </marker>
    <marker id="arrow-sel" markerWidth="12" markerHeight="12" refX="10" refY="3" orient="auto">
      <path d="M0,0 L0,6 L10,3 z" fill="#ffffff"/>
    </marker>`;
  svg.appendChild(defs);

  graphState.edges.forEach(edge => {
    const fromNode = graphState.nodes.find(n => n.id === edge.from);
    const toNode   = graphState.nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return;

    const { d, start, end, cp1x, cp1y, cp2x, cp2y } = buildEdgePath(edge, fromNode, toNode);
    const isSelected = selectedEdge?.id === edge.id;

    // Hit path
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', d);
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '16');
    hitPath.setAttribute('fill', 'none');
    hitPath.style.pointerEvents = 'stroke';
    hitPath.style.cursor = 'pointer';
    hitPath.addEventListener('click', ev => {
      ev.stopPropagation();
      multiSelect.clear();
      selectedNode = null;
      clearNodeHighlights();
      selectEdge(edge.id);
    });
    svg.appendChild(hitPath);

    // Visible path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke',       isSelected ? '#ffffff' : (toNode.color || '#13d38e'));
    path.setAttribute('stroke-width', isSelected ? '3.5' : '2.5');
    path.setAttribute('fill',         'none');
    path.setAttribute('marker-end',   isSelected ? 'url(#arrow-sel)' : 'url(#arrow)');
    svg.appendChild(path);

    // Waypoint handles (only when edge is selected)
    if (isSelected) {
      // Show handles at t=0.25, 0.5, 0.75 of the base bezier
      // Plus handles for existing waypoints
      if (!edge.waypoints || edge.waypoints.length === 0) {
        // Show 3 handles on the base bezier for adding waypoints
        [0.25, 0.5, 0.75].forEach(t => {
          const pt = bezierPoint(t,
            { x: start.x, y: start.y },
            { x: cp1x, y: cp1y },
            { x: cp2x, y: cp2y },
            { x: end.x, y: end.y }
          );
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', pt.x);
          circle.setAttribute('cy', pt.y);
          circle.setAttribute('r', '6');
          circle.setAttribute('fill', '#1a1a1a');
          circle.setAttribute('stroke', '#13d38e');
          circle.setAttribute('stroke-width', '2');
          circle.classList.add('wp-handle');
          circle.style.pointerEvents = 'all';

          // Drag to create a new waypoint at this position
          circle.addEventListener('mousedown', ev => {
            ev.stopPropagation();
            ev.preventDefault();
            pushHistory();
            if (!edge.waypoints) edge.waypoints = [];
            const insertIdx = Math.round(t * (edge.waypoints.length + 1));
            edge.waypoints.splice(insertIdx, 0, { x: Math.round(pt.x), y: Math.round(pt.y) });
            redrawEdges();
            // Start dragging the new waypoint
            startWaypointDrag(ev, edge, insertIdx);
          });
          svg.appendChild(circle);
        });
      } else {
        // Show handles for existing waypoints
        edge.waypoints.forEach((wp, idx) => {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', wp.x);
          circle.setAttribute('cy', wp.y);
          circle.setAttribute('r', '7');
          circle.setAttribute('fill', '#13d38e');
          circle.setAttribute('stroke', '#ffffff');
          circle.setAttribute('stroke-width', '1.5');
          circle.classList.add('wp-handle');
          circle.style.pointerEvents = 'all';

          // Drag to move
          circle.addEventListener('mousedown', ev => {
            ev.stopPropagation();
            ev.preventDefault();
            startWaypointDrag(ev, edge, idx);
          });

          // Double-click to remove
          circle.addEventListener('dblclick', ev => {
            ev.stopPropagation();
            pushHistory();
            edge.waypoints.splice(idx, 1);
            if (edge.waypoints.length === 0) delete edge.waypoints;
            redrawEdges();
          });

          svg.appendChild(circle);
        });

        // Also show add-handles between waypoints and endpoints
        const addPoints = [];
        const pts = [start, ...edge.waypoints, end];
        for (let i = 0; i < pts.length - 1; i++) {
          addPoints.push({
            x: (pts[i].x + pts[i+1].x) / 2,
            y: (pts[i].y + pts[i+1].y) / 2,
            insertIdx: i + 1
          });
        }
        addPoints.forEach(ap => {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', ap.x);
          circle.setAttribute('cy', ap.y);
          circle.setAttribute('r', '4');
          circle.setAttribute('fill', '#1a1a1a');
          circle.setAttribute('stroke', '#13d38e');
          circle.setAttribute('stroke-width', '1.5');
          circle.setAttribute('stroke-dasharray', '2,2');
          circle.classList.add('wp-handle');
          circle.style.pointerEvents = 'all';

          circle.addEventListener('mousedown', ev => {
            ev.stopPropagation();
            ev.preventDefault();
            pushHistory();
            const newWP = { x: Math.round(ap.x), y: Math.round(ap.y) };
            const actualIdx = ap.insertIdx - 1; // waypoints array idx
            edge.waypoints.splice(actualIdx, 0, newWP);
            redrawEdges();
            startWaypointDrag(ev, edge, actualIdx);
          });
          svg.appendChild(circle);
        });
      }
    }
  });
}

function startWaypointDrag(startEvt, edge, wpIdx) {
  const wp = edge.waypoints[wpIdx];
  if (!wp) return;

  const startX = startEvt.clientX;
  const startY = startEvt.clientY;
  const origX  = wp.x;
  const origY  = wp.y;

  const move = e => {
    wp.x = Math.round(origX + (e.clientX - startX) / zoomLevel);
    wp.y = Math.round(origY + (e.clientY - startY) / zoomLevel);
    redrawEdges();
  };

  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup',   up);
  };

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup',   up);
}

// ── Zoom & Pan ─────────────────────────────────────────────────────────────
function applyTransform() {
  canvas.style.transform = `translate(${panX}px,${panY}px) scale(${zoomLevel})`;
  redrawEdges();
  if (zoomDisplay) zoomDisplay.textContent = Math.round(zoomLevel * 100) + '%';
}

document.getElementById('zoom-in')?.addEventListener('click',  () => { zoomLevel = Math.min(zoomLevel * 1.2, 4);    applyTransform(); });
document.getElementById('zoom-out')?.addEventListener('click', () => { zoomLevel = Math.max(zoomLevel / 1.2, 0.25); applyTransform(); });

canvasWrapper.addEventListener('wheel', e => {
  e.preventDefault();
  zoomLevel *= e.deltaY > 0 ? 0.9 : 1.1;
  zoomLevel = Math.max(0.25, Math.min(zoomLevel, 4));
  applyTransform();
}, { passive: false });

let spacePressed = false;
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !connectingFrom) {
    spacePressed = true;
    canvas.style.cursor = 'grab';
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') {
    spacePressed = false;
    canvas.style.cursor = connectingFrom ? 'crosshair' : 'default';
  }
});

canvasWrapper.addEventListener('mousedown', e => {
  if ((e.button === 1 || (e.button === 0 && spacePressed)) && !connectingFrom) {
    isPanning  = true;
    panStartX  = e.clientX - panX;
    panStartY  = e.clientY - panY;
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
    e.stopPropagation();
  }
});

document.addEventListener('mousemove', e => {
  if (!isPanning) return;
  panX = e.clientX - panStartX;
  panY = e.clientY - panStartY;
  applyTransform();
});

document.addEventListener('mouseup', () => {
  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = connectingFrom ? 'crosshair' : (spacePressed ? 'grab' : 'default');
  }
});

// ── Palette Drag-Start ─────────────────────────────────────────────────────
document.querySelectorAll('[draggable="true"]').forEach(item => {
  item.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', item.dataset.type));
});

// ── Canvas-Klick → Auswahl aufheben ───────────────────────────────────────
canvas.addEventListener('click', e => {
  if (e.target === canvas || e.target.classList.contains('edge-layer') ||
      e.target.tagName === 'svg') {
    if (connectingFrom) {
      exitConnectMode();
    } else {
      multiSelect.clear();
      selectedNode = null;
      selectedEdge = null;
      clearNodeHighlights();
      updateInspector();
      redrawEdges();
    }
  }
});

// ── Keyboard-Shortcuts ─────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  if ((e.key === 'Delete' || e.key === 'Backspace') &&
      (selectedNode || selectedEdge || multiSelect.size > 0)) {
    e.preventDefault();
    deleteSelected();
  }
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveGraph(); }
  if (e.key === 'Escape') {
    if (connectingFrom) { exitConnectMode(); return; }
    if (document.getElementById('preview-modal').classList.contains('open')) { closePreview(); return; }
    // Auswahl aufheben
    if (multiSelect.size > 0 || selectedNode || selectedEdge) {
      multiSelect.clear();
      selectedNode = null;
      selectedEdge = null;
      clearNodeHighlights();
      redrawEdges();
      updateInspector();
    }
  }
});

// ── Save → Backend ─────────────────────────────────────────────────────────
async function saveGraph() {
  const btn = document.getElementById('btn-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Speichern…'; }
  try {
    const r = await fetch('/save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nodes: graphState.nodes, edges: graphState.edges })
    });
    const j = await r.json();
    showToast(j.status === 'saved' ? '✓ Gespeichert' : ('Fehler: ' + JSON.stringify(j)), j.status === 'saved');
  } catch (err) {
    showToast('Backend nicht erreichbar – Graph lokal gespeichert', false);
    localStorage.setItem('bi_graph', JSON.stringify({ nodes: graphState.nodes, edges: graphState.edges }));
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Speichern'; }
}

// ── Validate → Backend ─────────────────────────────────────────────────────
async function validateGraph() {
  const btn = document.getElementById('btn-validate');
  if (btn) { btn.disabled = true; btn.textContent = 'Prüfe…'; }
  try {
    const r = await fetch('/validate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nodes: graphState.nodes, edges: graphState.edges })
    });
    const j = await r.json();
    showToast((j.valid ? '✓ ' : '✗ ') + j.message, j.valid);
  } catch {
    showToast('Backend nicht erreichbar', false);
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Validieren'; }
}

// ── Export JSON ────────────────────────────────────────────────────────────
function exportJSON() {
  const data = JSON.stringify({ nodes: graphState.nodes, edges: graphState.edges }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'bi_graph.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Import JSON ────────────────────────────────────────────────────────────
function importJSON() {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = '.json';
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges))
          throw new Error('Ungültiges Format');
        pushHistory();
        graphState.nodes  = data.nodes;
        graphState.edges  = data.edges;
        graphState.nextId = Math.max(0, ...data.nodes.map(n => n.id ?? 0)) + 1;
        multiSelect.clear();
        fullRedraw();
        showToast('✓ Importiert: ' + data.nodes.length + ' Nodes, ' + data.edges.length + ' Edges', true);
      } catch (err) {
        showToast('Import fehlgeschlagen: ' + err.message, false);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ── Grid Snap Toggle ───────────────────────────────────────────────────────
document.getElementById('btn-snap')?.addEventListener('click', () => {
  snap = !snap;
  const btn = document.getElementById('btn-snap');
  if (snap) {
    btn.classList.add('snap-active');
  } else {
    btn.classList.remove('snap-active');
  }
  showToast('Grid Snap: ' + (snap ? 'EIN' : 'AUS'), true);
});

// ── Preview ────────────────────────────────────────────────────────────────
const previewModal = document.getElementById('preview-modal');

function openPreview() {
  previewModal.classList.add('open');
  lucide.createIcons();
  loadPreview();
}

function closePreview() {
  previewModal.classList.remove('open');
}

document.getElementById('btn-preview')?.addEventListener('click', openPreview);
document.getElementById('preview-close')?.addEventListener('click', closePreview);
previewModal.addEventListener('click', e => {
  if (e.target === previewModal) closePreview();
});

async function loadPreview() {
  const body = document.getElementById('preview-body');
  body.innerHTML = '<div class="text-gray-500">Lade Vorschau…</div>';

  let states = null;

  try {
    const r = await fetch('/bi/preview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nodes: graphState.nodes, edges: graphState.edges })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    states = j.states;
  } catch {
    // Mock data for demo nodes
    states = graphState.nodes.map((n, i) => {
      const mockStates = ['OK', 'OK', 'WARNING', 'CRITICAL', 'UNKNOWN'];
      const st = mockStates[i % mockStates.length];
      return {
        node_id: n.id,
        label:   n.label,
        state:   st,
        reason:  st === 'OK' ? 'All checks passing' :
                 st === 'WARNING' ? 'Response time elevated' :
                 st === 'CRITICAL' ? 'Service unreachable' : 'No data'
      };
    });
  }

  if (!states || states.length === 0) {
    body.innerHTML = '<div class="text-gray-500">Keine Daten verfügbar.</div>';
    return;
  }

  const rows = states.map(s => `
    <tr class="border-b border-[#2a2a2a] hover:bg-[#2a2a2a] transition">
      <td class="px-4 py-2 text-gray-300">#${s.node_id}</td>
      <td class="px-4 py-2 text-white font-medium">${escHtml(s.label)}</td>
      <td class="px-4 py-2">
        <span class="state-${s.state} px-2 py-0.5 rounded text-xs font-bold">${s.state}</span>
      </td>
      <td class="px-4 py-2 text-gray-400 text-xs">${escHtml(s.reason || '')}</td>
    </tr>
  `).join('');

  body.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-[#3a3a3a] text-gray-400 text-xs uppercase tracking-wide">
          <th class="px-4 py-2 text-left">ID</th>
          <th class="px-4 py-2 text-left">Label</th>
          <th class="px-4 py-2 text-left">State</th>
          <th class="px-4 py-2 text-left">Reason</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg, ok = true) {
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

// ── Toolbar-Button Events ──────────────────────────────────────────────────
document.getElementById('btn-undo')?.addEventListener('click',     undo);
document.getElementById('btn-redo')?.addEventListener('click',     redo);
document.getElementById('btn-save')?.addEventListener('click',     saveGraph);
document.getElementById('btn-validate')?.addEventListener('click', validateGraph);
document.getElementById('btn-export')?.addEventListener('click',   exportJSON);
document.getElementById('btn-import')?.addEventListener('click',   importJSON);

// ── Demo-Graph ─────────────────────────────────────────────────────────────
function loadDemoGraph() {
  const demo = [
    { id: 1, type: 'host',       label: 'web-prod-01', x: 320, y: 280, color: '#A5D6A7', icon: 'server'    },
    { id: 2, type: 'aggregator', label: 'Frontend',    x: 620, y: 220, color: '#13d38e', icon: 'git-merge', aggType: 'best' },
    { id: 3, type: 'service',    label: 'HTTP Check',  x: 380, y: 420, color: '#90A4AE', icon: 'activity'  },
    { id: 4, type: 'aggregator', label: 'Core',        x: 880, y: 300, color: '#13d38e', icon: 'git-merge', aggType: 'and'  }
  ];
  graphState.nextId = 5;
  demo.forEach(node => {
    graphState.nodes.push(node);
    const el = createNodeElement(node);
    canvas.appendChild(el);
    makeDraggable(el);
  });
  graphState.edges.push(
    { id: 'e1', from: 1, to: 2 },
    { id: 'e2', from: 3, to: 2 },
    { id: 'e3', from: 2, to: 4 }
  );
  redrawEdges();
  lucide.createIcons();
}

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
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
  updateUndoRedoButtons();
  if (zoomDisplay) zoomDisplay.textContent = '100%';

  // Init snap button state (default ON)
  const snapBtn = document.getElementById('btn-snap');
  if (snapBtn) snapBtn.classList.add('snap-active');
}

init();
