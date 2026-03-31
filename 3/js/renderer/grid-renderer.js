import { state, graphState, multiSelect, canvas, canvasWrapper, snaplineLayer } from '../core/state.js';
import { SNAP_TOL } from '../core/constants.js';

export function computeSnaplines(draggedId, nx, ny) {
  const nw = 140, nh = 50;
  const others = graphState.nodes.filter(n => n.id !== draggedId && !multiSelect.has(n.id));
  const lines = [];
  let snapX = null, snapY = null;

  const dragXC = [nx, nx + nw/2, nx + nw];
  const dragYC = [ny, ny + nh/2, ny + nh];

  others.forEach(other => {
    const oxc = [other.x, other.x + nw/2, other.x + nw];
    dragXC.forEach(dxc => {
      oxc.forEach(ox => {
        if (Math.abs(dxc - ox) <= SNAP_TOL && snapX === null) {
          snapX = nx + (ox - dxc);
          lines.push({ type: 'v', x: ox });
        }
      });
    });
    const oyc = [other.y, other.y + nh/2, other.y + nh];
    dragYC.forEach(dyc => {
      oyc.forEach(oy => {
        if (Math.abs(dyc - oy) <= SNAP_TOL && snapY === null) {
          snapY = ny + (oy - dyc);
          lines.push({ type: 'h', y: oy });
        }
      });
    });
  });
  return { snapX, snapY, lines };
}

export function drawSnaplines(lines) {
  while (snaplineLayer.firstChild) snaplineLayer.removeChild(snaplineLayer.firstChild);
  if (!lines?.length) return;

  const wrapRect  = canvasWrapper.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const w = wrapRect.width, h = wrapRect.height;

  lines.forEach(line => {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('stroke-dasharray', '4,4');
    l.setAttribute('stroke-width', '1');
    l.setAttribute('opacity', '0.85');
    if (line.type === 'v') {
      const sx = line.x * state.zoomLevel + state.panX + canvasRect.left - wrapRect.left;
      l.setAttribute('x1', sx); l.setAttribute('y1', '0');
      l.setAttribute('x2', sx); l.setAttribute('y2', h);
      l.setAttribute('stroke', '#13d38e');
    } else {
      const sy = line.y * state.zoomLevel + state.panY + canvasRect.top - wrapRect.top;
      l.setAttribute('x1', '0'); l.setAttribute('y1', sy);
      l.setAttribute('x2', w);   l.setAttribute('y2', sy);
      l.setAttribute('stroke', '#e74c3c');
    }
    snaplineLayer.appendChild(l);
  });
}

export function clearSnaplines() {
  while (snaplineLayer.firstChild) snaplineLayer.removeChild(snaplineLayer.firstChild);
}
