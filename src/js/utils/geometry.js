import { state } from '../core/state.js';

// ── Grid-Snap ─────────────────────────────────────────────────────────────
export function snapToGrid(v) {
  return state.snap ? Math.round(v / 20) * 20 : v;
}

// ── Node-Größe (liest echte DOM-Dimensionen) ──────────────────────────────
export function getNodeSize(node) {
  const el = document.querySelector(`[data-id="${node.id}"]`);
  return {
    w: el ? el.offsetWidth  : 140,
    h: el ? el.offsetHeight : 50,
  };
}

// Schnittpunkt Linie node-center → (targetX, targetY) mit Knotenbegrenzung
export function getEdgePointToTarget(node, targetX, targetY) {
  const { w: nw, h: nh } = getNodeSize(node);
  const cx = node.x + nw / 2;
  const cy = node.y + nh / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: node.y + nh };
  if (Math.abs(dx) > Math.abs(dy)) {
    const x = dx > 0 ? node.x + nw : node.x;
    const y = cy + dy * ((x - cx) / dx);
    return { x, y: Math.max(node.y, Math.min(node.y + nh, y)) };
  } else {
    const y = dy > 0 ? node.y + nh : node.y;
    const x = cx + dx * ((y - cy) / dy);
    return { x: Math.max(node.x, Math.min(node.x + nw, x)), y };
  }
}

export function getEdgePoint(node, targetNode) {
  const { w: tw, h: th } = getNodeSize(targetNode);
  return getEdgePointToTarget(node, targetNode.x + tw / 2, targetNode.y + th / 2);
}

// ── Port-Position (absolut im Canvas) ────────────────────────────────────
export function getPortPoint(node, port) {
  const { w, h } = getNodeSize(node);
  switch (port) {
    case 'top':    return { x: node.x + w / 2, y: node.y };
    case 'right':  return { x: node.x + w,     y: node.y + h / 2 };
    case 'bottom': return { x: node.x + w / 2, y: node.y + h };
    case 'left':   return { x: node.x,         y: node.y + h / 2 };
    default:       return { x: node.x + w / 2, y: node.y + h / 2 };
  }
}

// ── Bézier-Punkt bei t ────────────────────────────────────────────────────
export function bezierPoint(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  return {
    x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
    y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y,
  };
}
