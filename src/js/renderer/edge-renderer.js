import { graphState, state, canvas } from '../core/state.js';
import { getEdgePoint, getEdgePointToTarget, bezierPoint, getPortPoint } from '../utils/geometry.js';
import { selectEdge } from '../core/actions.js';
import { openEdgeCtxMenu } from '../ui/context-menu.js';

// ── Persistent Edge-SVG (einmal erstellt, wiederverwendet) ────────────────
export const edgeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
edgeSvg.classList.add('edge-layer');
edgeSvg.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;';
// Wird in renderer.js an canvas angehängt, nachdem canvas-Ref verfügbar ist

// ── Gerundete Ecken: Orthogonale Segmente mit Quadratic-Bézier-Bögen ─────────
const CORNER_R = 14;

function _roundedPath(pts, r = CORNER_R) {
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
  }
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
    const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const radius = Math.min(r, d1 / 2, d2 / 2);
    if (radius < 2) {
      d += ` L ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
      continue;
    }
    const t1 = radius / d1;
    const bx = curr.x - (curr.x - prev.x) * t1;
    const by = curr.y - (curr.y - prev.y) * t1;
    const t2 = radius / d2;
    const ax = curr.x + (next.x - curr.x) * t2;
    const ay = curr.y + (next.y - curr.y) * t2;
    d += ` L ${bx.toFixed(1)},${by.toFixed(1)} Q ${curr.x.toFixed(1)},${curr.y.toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)},${last.y.toFixed(1)}`;
  return d;
}

// ── Pfad-Berechnung ────────────────────────────────────────────────────────
export function buildEdgePath(edge, fromNode, toNode) {
  // Port-Override: wenn Ports gesetzt, exakte Port-Position nutzen
  const _pStart = edge.fromPort ? getPortPoint(fromNode, edge.fromPort) : null;
  const _pEnd   = edge.toPort   ? getPortPoint(toNode,   edge.toPort)   : null;

  if (edge.routing === 'straight') {
    let start, end;
    if (edge.waypoints?.length > 0) {
      const firstWP = edge.waypoints[0];
      const lastWP  = edge.waypoints[edge.waypoints.length - 1];
      start = _pStart || getEdgePointToTarget(fromNode, firstWP.x, firstWP.y);
      end   = _pEnd   || getEdgePointToTarget(toNode,   lastWP.x,  lastWP.y);
      const pts = [start, ...edge.waypoints, end];
      const d   = _roundedPath(pts);
      return { d, start, end, cp1x: start.x, cp1y: start.y, cp2x: end.x, cp2y: end.y };
    }
    start = _pStart || getEdgePoint(fromNode, toNode);
    end   = _pEnd   || getEdgePoint(toNode,   fromNode);
    const d = `M ${start.x},${start.y} L ${end.x},${end.y}`;
    return { d, start, end, cp1x: start.x, cp1y: start.y, cp2x: end.x, cp2y: end.y };
  }

  // Bézier
  const start = _pStart || getEdgePoint(fromNode, toNode);
  const end   = _pEnd   || getEdgePoint(toNode,   fromNode);
  const dx    = end.x - start.x;
  const dy    = end.y - start.y;
  let offset  = Math.max(40, Math.hypot(dx, dy) * 0.35);
  let cp1x = start.x, cp1y = start.y, cp2x = end.x, cp2y = end.y;
  if (Math.abs(dx) > Math.abs(dy) * 1.5) {
    cp1x = start.x + dx*0.33; cp1y = start.y + (dy>0?offset:-offset);
    cp2x = end.x   - dx*0.33; cp2y = end.y   + (dy>0?offset:-offset);
  } else if (Math.abs(dy) > Math.abs(dx) * 1.5) {
    cp1x = start.x + (dx>0?offset:-offset); cp1y = start.y + dy*0.33;
    cp2x = end.x   + (dx>0?-offset:offset); cp2y = end.y   - dy*0.33;
  } else {
    cp1x = start.x + dx*0.4; cp1y = start.y + dy*0.2;
    cp2x = end.x   - dx*0.4; cp2y = end.y   - dy*0.2;
  }
  const collides = graphState.nodes.some(n => {
    if (n.id === fromNode.id || n.id === toNode.id) return false;
    const t = ((n.x-start.x)*dx + (n.y-start.y)*dy) / (dx*dx+dy*dy);
    if (t < 0.1 || t > 0.9) return false;
    const ix = start.x+t*dx, iy = start.y+t*dy;
    return ix>n.x-20 && ix<n.x+160 && iy>n.y-20 && iy<n.y+70;
  });
  if (collides) {
    offset *= 1.6;
    cp1y += dy>0?offset*0.6:-offset*0.6;
    cp2y += dy>0?-offset*0.6:offset*0.6;
  }
  if (edge.waypoints?.length > 0) {
    let d = `M ${start.x},${start.y}`;
    const pts = [start, ...edge.waypoints, end];
    for (let i = 0; i < pts.length-1; i++) {
      const a = pts[i], b = pts[i+1];
      const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
      if (i === 0)              d += ` Q ${a.x},${a.y} ${mx},${my}`;
      else if (i===pts.length-2) d += ` Q ${b.x},${b.y} ${b.x},${b.y}`;
      else                       d += ` Q ${a.x},${a.y} ${mx},${my}`;
    }
    return { d, start, end, cp1x, cp1y, cp2x, cp2y };
  }
  const d = `M ${start.x},${start.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${end.x},${end.y}`;
  return { d, start, end, cp1x, cp1y, cp2x, cp2y };
}

// ── Waypoint-Drag ─────────────────────────────────────────────────────────
export function startWaypointDrag(startEvt, edge, wpIdx) {
  const wp = edge.waypoints[wpIdx];
  if (!wp) return;
  const startX = startEvt.clientX, startY = startEvt.clientY;
  const origX  = wp.x,             origY  = wp.y;

  const { scheduleRedrawEdges } = await_import_renderer();
  const move = e => {
    wp.x = Math.round(origX + (e.clientX-startX)/state.zoomLevel);
    wp.y = Math.round(origY + (e.clientY-startY)/state.zoomLevel);
    import('../renderer/renderer.js').then(m => m.scheduleRedrawEdges());
  };
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup',   up);
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup',   up);
}

function await_import_renderer() { return {}; } // placeholder; see startWaypointDrag

// ── Kanten zeichnen ───────────────────────────────────────────────────────
export function redrawEdges(scheduleRedrawEdgesFn) {
  const svg = edgeSvg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  // Marker in 3 Größen × 3 Stile × 2 Zustände (normal/sel) — via viewBox-Skalierung
  {
    const SIZES   = { sm: [5,4], md: [8,6], lg: [13,10] };
    const COLORS  = { '': '#13d38e', '-sel': '#ffffff', '-sel-light': '#1a1a1a' };
    let h = '';
    Object.entries(SIZES).forEach(([sz, [mw, mh]]) => {
      Object.entries(COLORS).forEach(([sfx, col]) => {
        h += `
          <marker id="arrow-chevron-${sz}${sfx}" viewBox="0 0 10 8" markerWidth="${mw}" markerHeight="${mh}" refX="9" refY="4" orient="auto">
            <path d="M0,0 L9,4 L0,8 Z" fill="${col}"/></marker>
          <marker id="arrow-thin-${sz}${sfx}" viewBox="0 0 10 8" markerWidth="${mw}" markerHeight="${mh}" refX="9" refY="4" orient="auto">
            <path d="M1,0.5 L9,4 L1,7.5" stroke="${col}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></marker>
          <marker id="arrow-dot-${sz}${sfx}" viewBox="0 0 10 8" markerWidth="${mw}" markerHeight="${mh}" refX="8" refY="4" orient="auto">
            <circle cx="4.5" cy="4" r="3.5" fill="${col}"/></marker>`;
      });
    });
    defs.innerHTML = h;
  }
  svg.appendChild(defs);

  graphState.edges.forEach(edge => {

    const fromNode = graphState.nodes.find(n => n.id === edge.from);
    const toNode   = graphState.nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return;

    const { d, start, end, cp1x, cp1y, cp2x, cp2y } = buildEdgePath(edge, fromNode, toNode);
    const isSelected = state.selectedEdge?.id === edge.id;

    // Hit-Path (unsichtbar, für Klicks)
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', d);
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '16');
    hitPath.setAttribute('fill', 'none');
    hitPath.style.pointerEvents = 'stroke';
    hitPath.style.cursor = 'pointer';
    hitPath.addEventListener('click', ev => {
      ev.stopPropagation();
      import('../core/state.js').then(m => { m.multiSelect.clear(); m.state.selectedNode = null; });
      import('../core/actions.js').then(m => { m.clearNodeHighlights(); m.selectEdge(edge.id); });
    });
    hitPath.addEventListener('contextmenu', ev => {
      ev.preventDefault(); ev.stopPropagation();
      import('../core/state.js').then(m => { m.multiSelect.clear(); m.state.selectedNode = null; });
      import('../core/actions.js').then(m => { m.clearNodeHighlights(); m.selectEdge(edge.id); });
      openEdgeCtxMenu(edge, ev.clientX, ev.clientY);
    });
    svg.appendChild(hitPath);

    // Sichtbarer Pfad
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const arrowStyle = edge.arrowStyle ?? 'none';
    const arrowSize  = edge.arrowSize  ?? 'sm';
    const isLight    = document.documentElement.classList.contains('light');
    const selSfx     = isLight ? '-sel-light' : '-sel';
    const selColor   = isLight ? '#1a1a1a' : '#ffffff';
    const markerUrl  = arrowStyle === 'none' ? 'none'
      : isSelected ? `url(#arrow-${arrowStyle}-${arrowSize}${selSfx})` : `url(#arrow-${arrowStyle}-${arrowSize})`;
    path.setAttribute('d', d);
    path.setAttribute('stroke',       isSelected ? selColor : (toNode.color || '#13d38e'));
    path.setAttribute('stroke-width', isSelected ? '3.5' : '2.5');
    path.setAttribute('fill',         'none');
    path.setAttribute('marker-end',   markerUrl);
    svg.appendChild(path);

    // Waypoint-Handles (nur bei ausgewählter Kante)
    if (isSelected) {
      if (!edge.waypoints?.length) {
        [0.25, 0.5, 0.75].forEach(t => {
          const pt = bezierPoint(t, {x:start.x,y:start.y}, {x:cp1x,y:cp1y}, {x:cp2x,y:cp2y}, {x:end.x,y:end.y});
          const c = _wpCircle(pt.x, pt.y, 6, '#1a1a1a', '#13d38e', '2');
          c.addEventListener('mousedown', ev => {
            ev.stopPropagation(); ev.preventDefault();
            import('../core/actions.js').then(m => m.pushHistory());
            if (!edge.waypoints) edge.waypoints = [];
            const idx = Math.round(t * (edge.waypoints.length+1));
            edge.waypoints.splice(idx, 0, {x: Math.round(pt.x), y: Math.round(pt.y)});
            import('./renderer.js').then(m => m.scheduleRedrawEdges());
            _startWPDrag(ev, edge, idx);
          });
          svg.appendChild(c);
        });
      } else {
        edge.waypoints.forEach((wp, idx) => {
          const c = _wpCircle(wp.x, wp.y, 7, '#13d38e', '#ffffff', '1.5');
          c.addEventListener('mousedown', ev => { ev.stopPropagation(); ev.preventDefault(); _startWPDrag(ev, edge, idx); });
          c.addEventListener('dblclick', ev => {
            ev.stopPropagation();
            import('../core/actions.js').then(m => m.pushHistory());
            edge.waypoints.splice(idx, 1);
            if (!edge.waypoints.length) delete edge.waypoints;
            import('./renderer.js').then(m => m.scheduleRedrawEdges());
          });
          svg.appendChild(c);
        });
        const pts = [start, ...edge.waypoints, end];
        for (let i = 0; i < pts.length-1; i++) {
          const ap = { x: (pts[i].x+pts[i+1].x)/2, y: (pts[i].y+pts[i+1].y)/2, idx: i+1 };
          const c = _wpCircle(ap.x, ap.y, 4, '#1a1a1a', '#13d38e', '1.5', '2,2');
          c.addEventListener('mousedown', ev => {
            ev.stopPropagation(); ev.preventDefault();
            import('../core/actions.js').then(m => m.pushHistory());
            const newWP = { x: Math.round(ap.x), y: Math.round(ap.y) };
            edge.waypoints.splice(ap.idx-1, 0, newWP);
            import('./renderer.js').then(m => m.scheduleRedrawEdges());
            _startWPDrag(ev, edge, ap.idx-1);
          });
          svg.appendChild(c);
        }
      }
    }
  });
}

function _wpCircle(cx, cy, r, fill, stroke, sw, dash = '') {
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
  c.setAttribute('fill', fill); c.setAttribute('stroke', stroke); c.setAttribute('stroke-width', sw);
  if (dash) c.setAttribute('stroke-dasharray', dash);
  c.classList.add('wp-handle');
  c.style.pointerEvents = 'all';
  return c;
}

function _startWPDrag(startEvt, edge, wpIdx) {
  const wp = edge.waypoints[wpIdx];
  if (!wp) return;
  const sx = startEvt.clientX, sy = startEvt.clientY;
  const ox = wp.x, oy = wp.y;
  const move = e => {
    wp.x = Math.round(ox + (e.clientX-sx)/state.zoomLevel);
    wp.y = Math.round(oy + (e.clientY-sy)/state.zoomLevel);
    import('./renderer.js').then(m => m.scheduleRedrawEdges());
  };
  const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup',   up);
}
