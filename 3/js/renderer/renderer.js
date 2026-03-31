import { graphState, state, multiSelect, canvas } from '../core/state.js';
import { edgeSvg, redrawEdges as _redrawEdges } from './edge-renderer.js';
import { createNodeElement, releaseNodeEl, updateVisibility } from './node-renderer.js';
import { applyMultiSelectHighlights } from '../core/actions.js';
import { updateInspector } from '../ui/inspector.js';

// Persistent SVG an Canvas hängen (einmalig bei Modulstart)
canvas.appendChild(edgeSvg);

// ── RAF-Throttling ────────────────────────────────────────────────────────
let _rafPending = false;
export function scheduleRedrawEdges() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(() => { _rafPending = false; redrawEdges(); });
}

export function redrawEdges() {
  _redrawEdges();
}

// ── Vollständiges Neuzeichnen ─────────────────────────────────────────────
export function fullRedraw() {
  document.querySelectorAll('[data-id]').forEach(el => releaseNodeEl(el));
  document.querySelectorAll('.edge-layer').forEach(el => { if (el !== edgeSvg) el.remove(); });

  graphState.nodes.forEach(node => {
    const el = createNodeElement(node);
    canvas.appendChild(el);
    import('../interactions/drag-handler.js').then(m => m.makeDraggable(el));
  });

  redrawEdges();
  lucide.createIcons();
  applyMultiSelectHighlights();
  updateVisibility();
}

// ── Zoom & Pan ─────────────────────────────────────────────────────────────
export function applyTransform() {
  canvas.style.transform = `translate(${state.panX}px,${state.panY}px) scale(${state.zoomLevel})`;
  scheduleRedrawEdges();
  const zd = document.getElementById('zoom-level');
  if (zd) zd.textContent = Math.round(state.zoomLevel * 100) + '%';
  updateVisibility();
}
