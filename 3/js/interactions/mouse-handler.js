import { state, multiSelect, canvas, canvasWrapper } from '../core/state.js';
import { clearNodeHighlights, exitConnectMode } from '../core/actions.js';
import { applyTransform, scheduleRedrawEdges } from '../renderer/renderer.js';
import { updateInspector } from '../ui/inspector.js';

export function initMouseHandler() {
  // ── Zoom-Buttons ──────────────────────────────────────────────────────
  document.getElementById('zoom-in')?.addEventListener('click', () => {
    state.zoomLevel = Math.min(state.zoomLevel * 1.2, 4);
    applyTransform();
  });
  document.getElementById('zoom-out')?.addEventListener('click', () => {
    state.zoomLevel = Math.max(state.zoomLevel / 1.2, 0.25);
    applyTransform();
  });

  // ── Scroll-Zoom (zum Cursor) ──────────────────────────────────────────
  canvasWrapper.addEventListener('wheel', e => {
    e.preventDefault();
    const rect    = canvasWrapper.getBoundingClientRect();
    const mouseX  = e.clientX - rect.left;
    const mouseY  = e.clientY - rect.top;
    const oldZoom = state.zoomLevel;
    state.zoomLevel *= e.deltaY > 0 ? 0.9 : 1.1;
    state.zoomLevel  = Math.max(0.25, Math.min(state.zoomLevel, 4));
    state.panX = mouseX - (mouseX - state.panX) * (state.zoomLevel / oldZoom);
    state.panY = mouseY - (mouseY - state.panY) * (state.zoomLevel / oldZoom);
    applyTransform();
  }, { passive: false });

  // ── Space+Drag / Mittelklick = Pan ────────────────────────────────────
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !state.connectingFrom) {
      state.spacePressed = true;
      canvas.style.cursor = 'grab';
    }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      state.spacePressed = false;
      canvas.style.cursor = state.connectingFrom ? 'crosshair' : 'default';
    }
  });

  canvasWrapper.addEventListener('mousedown', e => {
    if ((e.button === 1 || (e.button === 0 && state.spacePressed)) && !state.connectingFrom) {
      state.isPanning  = true;
      state.panStartX  = e.clientX - state.panX;
      state.panStartY  = e.clientY - state.panY;
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
      e.stopPropagation();
    }
  });

  document.addEventListener('mousemove', e => {
    if (!state.isPanning) return;
    state.panX = e.clientX - state.panStartX;
    state.panY = e.clientY - state.panStartY;
    applyTransform();
  });

  document.addEventListener('mouseup', () => {
    if (state.isPanning) {
      state.isPanning = false;
      canvas.style.cursor = state.connectingFrom ? 'crosshair' : (state.spacePressed ? 'grab' : 'default');
    }
  });

  // ── Palette Drag-Start ────────────────────────────────────────────────
  document.querySelectorAll('[draggable="true"]').forEach(item => {
    item.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', item.dataset.type));
  });

  // ── Canvas-Klick → Auswahl aufheben ──────────────────────────────────
  canvas.addEventListener('click', e => {
    if (e.target === canvas || e.target.classList.contains('edge-layer') || e.target.tagName === 'svg') {
      if (state.connectingFrom) {
        exitConnectMode();
      } else {
        multiSelect.clear();
        state.selectedNode = null;
        state.selectedEdge = null;
        clearNodeHighlights();
        updateInspector();
        scheduleRedrawEdges();
      }
    }
  });
}
