import { graphState, state, canvas } from '../core/state.js';
import { getEdgePoint, getEdgePointToTarget, bezierPoint, getPortPoint } from '../utils/geometry.js';
import { selectEdge } from '../core/actions.js';
import { openEdgeCtxMenu } from '../ui/context-menu.js';

// ── Persistent Edge-SVG (einmal erstellt, wiederverwendet) ────────────────
export const edgeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
edgeSvg.classList.add('edge-layer');
edgeSvg.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;';
// Wird in renderer.js an canvas angehängt, nachdem canvas-Ref verfügbar ist

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
      const d   = 'M ' + pts.map(p => `${p.x},${p.y}`).join(' L ');
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
  defs.innerHTML = `
    <marker id="arrow"     markerWidth="12" markerHeight="12" refX="10" refY="3" orient="auto"><path d="M0,0 L0,6 L10,3 z" fill="#13d38e"/></marker>
    <marker id="arrow-sel" markerWidth="12" markerHeight="12" refX="10" refY="3" orient="auto"><path d="M0,0 L0,6 L10,3 z" fill="#ffffff"/></marker>`;
  svg.appendChild(defs);

  // Parallele Kanten: senkrechter Versatz
  const parallelOffset = {};
  {
    const groups = {};
    graphState.edges.forEach(e => {
      const key = [String(e.from), String(e.to)].sort().join('|');
      if (!groups[key]) groups[key] = [];
      groups[key].push(e.id);
    });
    Object.values(groups).forEach(ids => {
      if (ids.length < 2) return;
      const step = 2.5, base = -((ids.length-1)*step)/2;
      ids.forEach((id,i) => { parallelOffset[id] = base + i*step; });
    });
  }

  graphState.edges.forEach(edge => {
    const fromNode = graphState.nodes.find(n => n.id === edge.from);
    const toNode   = graphState.nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return;

    const { d: dRaw, start, end, cp1x, cp1y, cp2x, cp2y } = buildEdgePath(edge, fromNode, toNode);
    const pOff = parallelOffset[edge.id] ?? 0;
    let d = dRaw;
    if (Math.abs(pOff) > 0.1) {
      const dx = end.x-start.x, dy = end.y-start.y;
      const len = Math.hypot(dx,dy)||1;
      const nx = -dy/len*pOff, ny = dx/len*pOff;
      d = dRaw.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_,px,py) =>
        `${(+px+nx).toFixed(1)},${(+py+ny).toFixed(1)}`
      );
    }
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
    path.setAttribute('d', d);
    path.setAttribute('stroke',       isSelected ? '#ffffff' : (toNode.color || '#13d38e'));
    path.setAttribute('stroke-width', isSelected ? '3.5' : '2.5');
    path.setAttribute('fill',         'none');
    path.setAttribute('marker-end',   isSelected ? 'url(#arrow-sel)' : 'url(#arrow)');
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
