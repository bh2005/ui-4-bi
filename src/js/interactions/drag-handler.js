import { graphState, state, multiSelect } from '../core/state.js';
import { pushHistory, selectNode, selectEdge, clearNodeHighlights } from '../core/actions.js';
import { scheduleRedrawEdges } from '../renderer/renderer.js';
import { snapToGrid } from '../utils/geometry.js';
import { computeSnaplines, drawSnaplines, clearSnaplines } from '../renderer/grid-renderer.js';

export function makeDraggable(el) {
  el.addEventListener('mousedown', evt => {
    if (evt.button !== 0 || state.connectingFrom !== null) return;
    if (evt.target.tagName === 'INPUT') return;
    evt.stopPropagation();

    const id = parseInt(el.dataset.id);

    if (!evt.shiftKey && !multiSelect.has(id)) {
      multiSelect.clear();
      clearNodeHighlights();
      selectEdge(null);
      selectNode(id);
    }

    const startX = evt.clientX, startY = evt.clientY;
    const movingIds = multiSelect.size > 0 ? [...multiSelect] : [id];
    const origPos = {};
    movingIds.forEach(nid => {
      const node = graphState.nodes.find(n => n.id === nid);
      if (node) origPos[nid] = { x: node.x, y: node.y };
    });

    let moved = false;

    const move = e => {
      if (!moved) { pushHistory(); moved = true; }
      const dx = (e.clientX - startX) / state.zoomLevel;
      const dy = (e.clientY - startY) / state.zoomLevel;

      const dragOrig   = origPos[id];
      const newDragX   = snapToGrid(Math.round(dragOrig.x + dx));
      const newDragY   = snapToGrid(Math.round(dragOrig.y + dy));
      const snapResult = computeSnaplines(id, newDragX, newDragY);
      const sDX = (snapResult.snapX !== null ? snapResult.snapX : newDragX) - dragOrig.x;
      const sDY = (snapResult.snapY !== null ? snapResult.snapY : newDragY) - dragOrig.y;

      drawSnaplines(snapResult.lines);

      movingIds.forEach(nid => {
        const node = graphState.nodes.find(n => n.id === nid);
        if (!node) return;
        const orig = origPos[nid];
        node.x = Math.round(orig.x + sDX);
        node.y = Math.round(orig.y + sDY);
        const nodeEl = document.querySelector(`[data-id="${nid}"]`);
        if (nodeEl) { nodeEl.style.left = node.x + 'px'; nodeEl.style.top = node.y + 'px'; }
      });
      scheduleRedrawEdges();
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
