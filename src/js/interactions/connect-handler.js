import { graphState, state, canvas } from '../core/state.js';
import { nodeTypes } from '../core/constants.js';
import { pushHistory, logAudit, exitConnectMode } from '../core/actions.js';
import { createNodeElement } from '../renderer/node-renderer.js';
import { scheduleRedrawEdges, fullRedraw } from '../renderer/renderer.js';
import { snapToGrid } from '../utils/geometry.js';
import { makeDraggable } from './drag-handler.js';

export function initConnectHandler() {
  canvas.addEventListener('dragover', e => e.preventDefault());

  canvas.addEventListener('drop', e => {
    e.preventDefault();
    if (state.connectingFrom !== null) return;
    const type = e.dataTransfer.getData('text/plain');
    if (!type) return;
    const template = nodeTypes.find(t => t.type === type);
    if (!template) return;

    const rect = canvas.getBoundingClientRect();
    const rawX = (e.clientX - rect.left - state.panX) / state.zoomLevel;
    const rawY = (e.clientY - rect.top  - state.panY) / state.zoomLevel;
    const x    = snapToGrid(Math.round(rawX - 70));
    const y    = snapToGrid(Math.round(rawY - 25));

    pushHistory();
    const node = {
      id:      graphState.nextId++,
      type,
      label:   template.label,
      x, y,
      color:   template.color,
      icon:    template.icon,
      aggType: type === 'aggregator' ? 'and' : undefined,
    };
    logAudit('Node hinzugefügt', `${node.type}: ${node.label}`);
    graphState.nodes.push(node);
    const el = createNodeElement(node);
    canvas.appendChild(el);
    makeDraggable(el);
    lucide.createIcons();
  });
}
