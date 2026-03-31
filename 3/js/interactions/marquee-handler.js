import { graphState, state, multiSelect, canvas, canvasWrapper, marqueeEl } from '../core/state.js';
import { applyMultiSelectHighlights } from '../core/actions.js';
import { updateInspector } from '../ui/inspector.js';

export function initMarqueeHandler() {
  canvasWrapper.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (state.connectingFrom !== null || state.spacePressed || state.isPanning) return;
    const target = e.target;
    const isBackground = (
      target === canvas || target === canvasWrapper ||
      target.classList.contains('edge-layer') ||
      (target.tagName === 'svg'  && !target.classList.contains('wp-handle')) ||
      (target.tagName === 'path' && !target.dataset.edgeId)
    );
    if (!isBackground) return;

    state.marqueeActive = true;
    const wrapRect = canvasWrapper.getBoundingClientRect();
    state.marqueeStart = { x: e.clientX - wrapRect.left, y: e.clientY - wrapRect.top };
    marqueeEl.style.left   = state.marqueeStart.x + 'px';
    marqueeEl.style.top    = state.marqueeStart.y + 'px';
    marqueeEl.style.width  = '0px';
    marqueeEl.style.height = '0px';
    marqueeEl.classList.remove('hidden');
  });

  document.addEventListener('mousemove', e => {
    if (!state.marqueeActive) return;
    const wrapRect = canvasWrapper.getBoundingClientRect();
    const curX = e.clientX - wrapRect.left;
    const curY = e.clientY - wrapRect.top;
    marqueeEl.style.left   = Math.min(curX, state.marqueeStart.x) + 'px';
    marqueeEl.style.top    = Math.min(curY, state.marqueeStart.y) + 'px';
    marqueeEl.style.width  = Math.abs(curX - state.marqueeStart.x) + 'px';
    marqueeEl.style.height = Math.abs(curY - state.marqueeStart.y) + 'px';
  });

  document.addEventListener('mouseup', e => {
    if (!state.marqueeActive) return;
    state.marqueeActive = false;
    marqueeEl.classList.add('hidden');

    const wrapRect  = canvasWrapper.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const curX = e.clientX - wrapRect.left;
    const curY = e.clientY - wrapRect.top;

    const rx1 = Math.min(curX, state.marqueeStart.x);
    const ry1 = Math.min(curY, state.marqueeStart.y);
    const rx2 = Math.max(curX, state.marqueeStart.x);
    const ry2 = Math.max(curY, state.marqueeStart.y);
    if (rx2 - rx1 < 5 && ry2 - ry1 < 5) return;

    const cx1 = (rx1 - (canvasRect.left - wrapRect.left)) / state.zoomLevel;
    const cy1 = (ry1 - (canvasRect.top  - wrapRect.top )) / state.zoomLevel;
    const cx2 = (rx2 - (canvasRect.left - wrapRect.left)) / state.zoomLevel;
    const cy2 = (ry2 - (canvasRect.top  - wrapRect.top )) / state.zoomLevel;

    multiSelect.clear();
    state.selectedNode = null;
    state.selectedEdge = null;

    graphState.nodes.forEach(node => {
      if (node.x+70 >= cx1 && node.x+70 <= cx2 && node.y+25 >= cy1 && node.y+25 <= cy2)
        multiSelect.add(node.id);
    });

    applyMultiSelectHighlights();
    updateInspector();
  });
}
