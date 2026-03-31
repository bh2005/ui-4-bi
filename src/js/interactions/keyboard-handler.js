import { state, multiSelect } from '../core/state.js';
import { undo, redo, deleteSelected, clearNodeHighlights, exitConnectMode } from '../core/actions.js';
import { scheduleRedrawEdges } from '../renderer/renderer.js';
import { updateInspector } from '../ui/inspector.js';
import { saveGraph } from '../ui/toolbar.js';

export function initKeyboardHandler() {
  window.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    if ((e.key === 'Delete' || e.key === 'Backspace') &&
        (state.selectedNode || state.selectedEdge || multiSelect.size > 0)) {
      e.preventDefault();
      deleteSelected();
    }
    if (e.ctrlKey && e.key === 'z')                          { e.preventDefault(); undo(); }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
    if (e.ctrlKey && e.key === 's')                          { e.preventDefault(); saveGraph(); }

    if (e.key === 'Escape') {
      if (state.connectingFrom) { exitConnectMode(); return; }
      const pm = document.getElementById('preview-modal');
      if (pm?.classList.contains('open')) { pm.classList.remove('open'); return; }
      const am = document.getElementById('audit-modal');
      if (am?.classList.contains('open')) { am.classList.remove('open'); return; }
      if (multiSelect.size > 0 || state.selectedNode || state.selectedEdge) {
        multiSelect.clear();
        state.selectedNode = null;
        state.selectedEdge = null;
        clearNodeHighlights();
        scheduleRedrawEdges();
        updateInspector();
      }
    }
  });
}
