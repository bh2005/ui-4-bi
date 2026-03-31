import { graphState, history, state, multiSelect, auditLog } from './state.js';
// renderer imports are late-bound (circular ok in ES modules – called at runtime)
import { scheduleRedrawEdges, fullRedraw } from '../renderer/renderer.js';
import { updateInspector, updateUndoRedoButtons } from '../ui/inspector.js';

// ── Audit-Log ─────────────────────────────────────────────────────────────
export function logAudit(action, details = '') {
  const entry = { ts: new Date().toISOString(), user: state.currentUser, action, details };
  auditLog.unshift(entry);
  if (auditLog.length > 500) auditLog.pop();
  localStorage.setItem('bi_audit', JSON.stringify(auditLog.slice(0, 100)));
  fetch('/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
    .catch(() => {});
}

// ── History ───────────────────────────────────────────────────────────────
export function snapshot() {
  return JSON.stringify({ nodes: graphState.nodes, edges: graphState.edges, nextId: graphState.nextId });
}

export function pushHistory() {
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
  state.selectedNode = null;
  state.selectedEdge = null;
  multiSelect.clear();
  fullRedraw();
  updateInspector();
}

export function undo() {
  if (!history.past.length) return;
  history.future.push(snapshot());
  restoreSnapshot(history.past.pop());
  updateUndoRedoButtons();
}

export function redo() {
  if (!history.future.length) return;
  history.past.push(snapshot());
  restoreSnapshot(history.future.pop());
  updateUndoRedoButtons();
}

// ── Auswahl ───────────────────────────────────────────────────────────────
export function clearNodeHighlights() {
  document.querySelectorAll('[data-id]').forEach(el =>
    el.classList.remove(
      'ring-2', 'ring-white', 'ring-blue-400', 'ring-green-400',
      'ring-offset-2', 'ring-offset-[#1a1a1a]', 'animate-pulse', 'scale-105'
    )
  );
}

export function applyMultiSelectHighlights() {
  clearNodeHighlights();
  multiSelect.forEach(id => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2', 'ring-offset-[#1a1a1a]');
  });
  if (state.selectedNode) {
    const el = document.querySelector(`[data-id="${state.selectedNode.id}"]`);
    if (el) el.classList.add('ring-2', 'ring-white', 'ring-offset-2', 'ring-offset-[#1a1a1a]');
  }
}

export function selectNode(id) {
  state.selectedEdge = null;
  clearNodeHighlights();
  state.selectedNode = graphState.nodes.find(n => n.id === id) || null;
  if (!state.selectedNode) { updateInspector(); return; }
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) el.classList.add('ring-2', 'ring-white', 'ring-offset-2', 'ring-offset-[#1a1a1a]');
  updateInspector();
}

export function selectEdge(edgeId) {
  state.selectedNode = null;
  state.selectedEdge = edgeId ? graphState.edges.find(e => e.id === edgeId) : null;
  clearNodeHighlights();
  scheduleRedrawEdges();
  updateInspector();
}

export function toggleMultiSelect(id) {
  if (multiSelect.has(id)) {
    multiSelect.delete(id);
  } else {
    multiSelect.add(id);
    if (state.selectedNode) {
      multiSelect.add(state.selectedNode.id);
      state.selectedNode = null;
    }
  }
  state.selectedNode = null;
  state.selectedEdge = null;
  applyMultiSelectHighlights();
  updateInspector();
}

// ── Löschen ───────────────────────────────────────────────────────────────
export function deleteSelected() {
  if (multiSelect.size > 0) {
    pushHistory();
    const ids = new Set(multiSelect);
    logAudit('Nodes gelöscht', `${ids.size} Nodes`);
    graphState.nodes = graphState.nodes.filter(n => !ids.has(n.id));
    graphState.edges = graphState.edges.filter(e => !ids.has(e.from) && !ids.has(e.to));
    multiSelect.clear();
    state.selectedNode = null;
    fullRedraw();
    updateInspector();
  } else if (state.selectedNode) {
    pushHistory();
    const { id, label } = state.selectedNode;
    logAudit('Node gelöscht', label);
    graphState.nodes = graphState.nodes.filter(n => n.id !== id);
    graphState.edges = graphState.edges.filter(e => e.from !== id && e.to !== id);
    state.selectedNode = null;
    fullRedraw();
    updateInspector();
  } else if (state.selectedEdge) {
    pushHistory();
    const { id } = state.selectedEdge;
    const fn = graphState.nodes.find(n => n.id === state.selectedEdge.from);
    const tn = graphState.nodes.find(n => n.id === state.selectedEdge.to);
    logAudit('Verbindung gelöscht', `${fn?.label ?? state.selectedEdge.from} → ${tn?.label ?? state.selectedEdge.to}`);
    graphState.edges = graphState.edges.filter(e => e.id !== id);
    state.selectedEdge = null;
    scheduleRedrawEdges();
    updateInspector();
  }
}

// ── Align / Distribute ────────────────────────────────────────────────────
export function getSelectedNodes() {
  return graphState.nodes.filter(n => multiSelect.has(n.id));
}

export function updateNodeEl(node) {
  const el = document.querySelector(`[data-id="${node.id}"]`);
  if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; }
}

export function alignNodes(type) {
  const nodes = getSelectedNodes();
  if (nodes.length < 2) return;
  pushHistory();
  switch (type) {
    case 'left':        { const minX = Math.min(...nodes.map(n => n.x));          nodes.forEach(n => { n.x = minX; updateNodeEl(n); }); break; }
    case 'center-h':    { const cx = nodes.reduce((s,n) => s+n.x+70,0)/nodes.length; nodes.forEach(n => { n.x = Math.round(cx-70); updateNodeEl(n); }); break; }
    case 'right':       { const maxX = Math.max(...nodes.map(n => n.x+140));       nodes.forEach(n => { n.x = maxX-140; updateNodeEl(n); }); break; }
    case 'top':         { const minY = Math.min(...nodes.map(n => n.y));           nodes.forEach(n => { n.y = minY; updateNodeEl(n); }); break; }
    case 'middle-v':    { const cy = nodes.reduce((s,n) => s+n.y+25,0)/nodes.length; nodes.forEach(n => { n.y = Math.round(cy-25); updateNodeEl(n); }); break; }
    case 'bottom':      { const maxY = Math.max(...nodes.map(n => n.y+50));        nodes.forEach(n => { n.y = maxY-50; updateNodeEl(n); }); break; }
    case 'distribute-h': {
      const sorted = [...nodes].sort((a,b) => a.x - b.x);
      const step = (sorted[sorted.length-1].x - sorted[0].x) / (sorted.length-1);
      sorted.forEach((n,i) => { n.x = Math.round(sorted[0].x + i*step); updateNodeEl(n); });
      break;
    }
    case 'distribute-v': {
      const sorted = [...nodes].sort((a,b) => a.y - b.y);
      const step = (sorted[sorted.length-1].y - sorted[0].y) / (sorted.length-1);
      sorted.forEach((n,i) => { n.y = Math.round(sorted[0].y + i*step); updateNodeEl(n); });
      break;
    }
  }
  logAudit('Nodes ausgerichtet', type);
  scheduleRedrawEdges();
}

// ── Connect-Modus ─────────────────────────────────────────────────────────
export function enterConnectMode(fromId) {
  state.connectingFrom = fromId;
  const fromEl = document.querySelector(`[data-id="${fromId}"]`);
  if (fromEl) fromEl.classList.add('ring-green-400', 'animate-pulse', 'ring-offset-2', 'ring-offset-[#1a1a1a]');
  document.getElementById('canvas').style.cursor = 'crosshair';
}

export function exitConnectMode() {
  state.connectingFrom = null;
  document.getElementById('canvas').style.cursor = 'default';
  document.querySelectorAll('[data-id]').forEach(el =>
    el.classList.remove('ring-green-400', 'animate-pulse', 'scale-105')
  );
  if (state.selectedNode) selectNode(state.selectedNode.id);
  else applyMultiSelectHighlights();
}
