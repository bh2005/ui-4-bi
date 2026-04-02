import { graphState, state, multiSelect } from '../core/state.js';
import { aggregatorTypes } from '../core/constants.js';
import { pushHistory, selectNode, selectEdge, deleteSelected,
         logAudit, enterConnectMode } from '../core/actions.js';
import { scheduleRedrawEdges, fullRedraw } from '../renderer/renderer.js';
import { createNodeElement } from '../renderer/node-renderer.js';
import { startInlineEdit } from '../renderer/node-renderer.js';
import { makeDraggable } from '../interactions/drag-handler.js';

const ctxMenu = document.getElementById('ctx-menu');

export function closeCtxMenu() {
  ctxMenu.style.display = 'none';
  ctxMenu.innerHTML     = '';
}

export function showCtxMenu(x, y, items) {
  closeCtxMenu();
  items.forEach(item => {
    if (item === 'sep') {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:#3a3a3a;margin:4px 0;';
      ctxMenu.appendChild(sep);
      return;
    }
    const btn = document.createElement('button');
    btn.style.cssText = `
      display:flex;align-items:center;gap:8px;
      width:100%;padding:7px 14px;background:none;border:none;
      color:${item.danger?'#f87171':'#e5e7eb'};cursor:pointer;
      text-align:left;font-size:13px;white-space:nowrap;`;
    btn.innerHTML = `<span style="width:16px;text-align:center">${item.icon||''}</span>${item.label}`;
    btn.addEventListener('mouseenter', () => btn.style.background = '#333');
    btn.addEventListener('mouseleave', () => btn.style.background = 'none');
    btn.addEventListener('click', () => { closeCtxMenu(); item.action(); });
    if (item.disabled) { btn.disabled = true; btn.style.opacity = '0.4'; btn.style.cursor = 'default'; }
    ctxMenu.appendChild(btn);
  });
  ctxMenu.style.display = 'block';
  const mw = ctxMenu.offsetWidth, mh = ctxMenu.offsetHeight;
  ctxMenu.style.left = (x + mw > window.innerWidth  ? x - mw : x) + 'px';
  ctxMenu.style.top  = (y + mh > window.innerHeight ? y - mh : y) + 'px';
}

export function openNodeCtxMenu(node, x, y) {
  const nodeEl = document.querySelector(`[data-id="${node.id}"]`);
  const items = [
    { icon: '✏️', label: 'Label bearbeiten',   action: () => nodeEl && startInlineEdit(nodeEl, node) },
    { icon: '🔗', label: 'Verbinden mit…',     action: () => { selectNode(node.id); enterConnectMode(node.id); } },
  ];

  if (node.type === 'aggregator') {
    items.push('sep');
    aggregatorTypes.forEach(opt => {
      items.push({
        icon: node.aggType === opt.value ? '✓' : '',
        label: opt.label,
        action: () => {
          pushHistory();
          node.aggType = opt.value;
          const tl = nodeEl?.querySelector('.node-aggtype');
          if (tl) { tl.textContent = `(${opt.value.toUpperCase()})`; }
          else if (nodeEl) {
            const d = document.createElement('div');
            d.className   = 'text-xs opacity-80 mt-0.5 node-aggtype';
            d.textContent = `(${opt.value.toUpperCase()})`;
            nodeEl.appendChild(d);
          }
          logAudit('Aggregation geändert', `${node.label}: ${opt.value}`);
        }
      });
    });
  }

  items.push('sep');
  items.push({
    icon: '📋', label: 'Duplizieren',
    action: () => {
      pushHistory();
      const copy = { ...node, id: graphState.nextId++, x: node.x+40, y: node.y+40 };
      graphState.nodes.push(copy);
      const el = createNodeElement(copy);
      document.getElementById('canvas').appendChild(el);
      makeDraggable(el);
      lucide.createIcons();
      logAudit('Node dupliziert', copy.label);
    }
  });
  items.push({ icon: '🗑️', label: 'Löschen', danger: true, action: () => { selectNode(node.id); deleteSelected(); } });

  showCtxMenu(x, y, items);
}

export function openEdgeCtxMenu(edge, x, y) {
  const fromNode  = graphState.nodes.find(n => n.id === edge.from);
  const toNode    = graphState.nodes.find(n => n.id === edge.to);
  const isStraight = edge.routing === 'straight';
  const items = [
    {
      icon: isStraight ? '〰️' : '✓',
      label: isStraight ? 'Gebogen (Bézier)' : '✓ Gebogen (Bézier)',
      action: () => { pushHistory(); delete edge.routing; delete edge.waypoints; scheduleRedrawEdges(); }
    },
    {
      icon: !isStraight ? '📐' : '✓',
      label: isStraight ? '✓ Gerade' : 'Gerade',
      action: () => { pushHistory(); edge.routing = 'straight'; scheduleRedrawEdges(); }
    },
    'sep',
    {
      icon: '↩️', label: 'Waypoints zurücksetzen',
      disabled: !edge.waypoints?.length,
      action: () => { pushHistory(); delete edge.waypoints; scheduleRedrawEdges(); }
    },
    {
      icon: '🔄', label: 'Richtung umkehren',
      action: () => {
        pushHistory();
        [edge.from, edge.to] = [edge.to, edge.from];
        if (edge.waypoints) edge.waypoints.reverse();
        scheduleRedrawEdges();
        logAudit('Verbindung umgekehrt', `${toNode?.label} → ${fromNode?.label}`);
      }
    },
    'sep',
    { icon: '🗑️', label: 'Verbindung löschen', danger: true, action: () => { selectEdge(edge.id); deleteSelected(); } }
  ];
  showCtxMenu(x, y, items);
}

// Schließen bei Klick außerhalb
document.addEventListener('click', () => closeCtxMenu());
document.addEventListener('contextmenu', e => {
  if (e.target === ctxMenu || ctxMenu.contains(e.target)) e.preventDefault();
});
