import { graphState, state, multiSelect } from '../core/state.js';
import { LAYOUT } from '../core/constants.js';
import { pushHistory, logAudit } from '../core/actions.js';
import { scheduleRedrawEdges, fullRedraw } from '../renderer/renderer.js';
import { snapToGrid } from '../utils/geometry.js';
import { showToast } from './audit-ui.js';
import { exportToCMK, importFromCMK } from '../utils/cmk-bi-converter.js';

// ── Speichern ─────────────────────────────────────────────────────────────
export async function saveGraph() {
  const btn = document.getElementById('btn-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Speichern…'; }
  try {
    const r = await fetch('/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes: graphState.nodes, edges: graphState.edges }) });
    const j = await r.json();
    if (j.status === 'saved') logAudit('Graph gespeichert', `${graphState.nodes.length} Nodes, ${graphState.edges.length} Edges`);
    showToast(j.status === 'saved' ? '✓ Gespeichert' : ('Fehler: ' + JSON.stringify(j)), j.status === 'saved');
  } catch {
    showToast('Backend nicht erreichbar – Graph lokal gespeichert', false);
    localStorage.setItem('bi_graph', JSON.stringify({ nodes: graphState.nodes, edges: graphState.edges }));
    logAudit('Graph gespeichert (lokal)', `${graphState.nodes.length} Nodes, ${graphState.edges.length} Edges`);
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Speichern'; }
}

// ── Validieren ────────────────────────────────────────────────────────────
async function validateGraph() {
  const btn = document.getElementById('btn-validate');
  if (btn) { btn.disabled = true; btn.textContent = 'Prüfe…'; }
  try {
    const r = await fetch('/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes: graphState.nodes, edges: graphState.edges }) });
    const j = await r.json();
    showToast((j.valid ? '✓ ' : '✗ ') + j.message, j.valid);
  } catch { showToast('Backend nicht erreichbar', false); }
  if (btn) { btn.disabled = false; btn.textContent = 'Validieren'; }
}

// ── Export / Import ───────────────────────────────────────────────────────
function exportJSON() {
  const data = JSON.stringify({ nodes: graphState.nodes, edges: graphState.edges }, null, 2);
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = 'bi_graph.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJSON() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error('Ungültiges Format');
        pushHistory();
        graphState.nodes  = data.nodes;
        graphState.edges  = data.edges;
        graphState.nextId = Math.max(0, ...data.nodes.map(n => n.id ?? 0)) + 1;
        multiSelect.clear();
        logAudit('Graph importiert', file.name);
        fullRedraw();
        showToast(`✓ Importiert: ${data.nodes.length} Nodes, ${data.edges.length} Edges`, true);
      } catch (err) { showToast('Import fehlgeschlagen: ' + err.message, false); }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ── Snap-Toggle ───────────────────────────────────────────────────────────
function initSnapToggle() {
  const btn = document.getElementById('btn-snap');
  if (!btn) return;
  btn.classList.add('snap-active');
  btn.addEventListener('click', () => {
    state.snap = !state.snap;
    state.snap ? btn.classList.add('snap-active') : btn.classList.remove('snap-active');
    showToast('Grid Snap: ' + (state.snap ? 'EIN' : 'AUS'), true);
  });
}

// ── Raster-Snap ───────────────────────────────────────────────────────────
export function snapAllToGrid() {
  if (!graphState.nodes.length) return;
  pushHistory();
  graphState.nodes.forEach(node => {
    node.x = snapToGrid(node.x);
    node.y = snapToGrid(node.y);
    const el = document.querySelector(`[data-id="${node.id}"]`);
    if (el) {
      el.style.transition = 'left .2s ease, top .2s ease';
      el.style.left = node.x + 'px'; el.style.top = node.y + 'px';
    }
  });
  setTimeout(() => {
    document.querySelectorAll('[data-id]').forEach(el => el.style.transition = '');
    scheduleRedrawEdges();
  }, 220);
  logAudit('Raster ausrichten', `${graphState.nodes.length} Nodes`);
  showToast('Alle Nodes am Raster ausgerichtet', true);
}

// ── Auto Layout ───────────────────────────────────────────────────────────
export function autoLayout(dir = state.layoutDir) {
  if (dir === 'GRID') { snapAllToGrid(); return; }
  if (!graphState.nodes.length) return;
  pushHistory();

  const { NODE_W, NODE_H, GAP_X, GAP_Y, MARGIN } = LAYOUT;

  // 1. Eingangsgrad & Adjazenz
  const inDeg = {}, adjOut = {};
  graphState.nodes.forEach(n => { inDeg[n.id] = 0; adjOut[n.id] = []; });
  graphState.edges.forEach(e => {
    if (inDeg[e.to]     !== undefined) inDeg[e.to]++;
    if (adjOut[e.from] !== undefined) adjOut[e.from].push(e.to);
  });

  // 2. Topologische Sortierung + Longest-Path-Ranking
  const rank = {}, visited = new Set(), topo = [];
  const indegCopy = { ...inDeg };
  const bfsQ = graphState.nodes.filter(n => inDeg[n.id] === 0).map(n => n.id);
  bfsQ.forEach(id => { rank[id] = 0; });
  while (bfsQ.length) {
    const id = bfsQ.shift();
    topo.push(id); visited.add(id);
    adjOut[id]?.forEach(nid => { if (--indegCopy[nid] === 0) bfsQ.push(nid); });
  }
  graphState.nodes.forEach(n => { if (!visited.has(n.id)) topo.push(n.id); });
  topo.forEach(id => {
    if (rank[id] === undefined) rank[id] = 0;
    adjOut[id]?.forEach(nid => { rank[nid] = Math.max(rank[nid] ?? 0, rank[id]+1); });
  });

  // 3. Layer-Gruppen
  const layers = {};
  graphState.nodes.forEach(n => { const r = rank[n.id]??0; if (!layers[r]) layers[r]=[]; layers[r].push(n.id); });
  const layerKeys = Object.keys(layers).map(Number).sort((a,b) => a-b);

  // 4. Barycenter-Kreuzungsminimierung
  function barycenter(layerIds, refLayerIds, reverse=false) {
    if (!refLayerIds) return layerIds;
    const pos = {};
    refLayerIds.forEach((id,i) => { pos[id] = i; });
    return [...layerIds].sort((a,b) => {
      const nb = (nodeId) => reverse
        ? graphState.edges.filter(e => e.from===nodeId && pos[e.to]!==undefined).map(e=>pos[e.to])
        : graphState.edges.filter(e => e.to===nodeId   && pos[e.from]!==undefined).map(e=>pos[e.from]);
      const avg = ns => ns.length ? ns.reduce((s,v)=>s+v,0)/ns.length : Infinity;
      return avg(nb(a)) - avg(nb(b));
    });
  }
  for (let i=1; i<layerKeys.length; i++) layers[layerKeys[i]] = barycenter(layers[layerKeys[i]], layers[layerKeys[i-1]], false);
  for (let i=layerKeys.length-2; i>=0; i--) layers[layerKeys[i]] = barycenter(layers[layerKeys[i]], layers[layerKeys[i+1]], true);

  // 5. Koordinaten
  const maxCount  = Math.max(...layerKeys.map(k => layers[k].length));
  const maxLayerW = maxCount*NODE_W + (maxCount-1)*GAP_X;
  const maxLayerH = maxCount*NODE_H + (maxCount-1)*GAP_Y;
  layerKeys.forEach((layerIdx, li) => {
    const ids = layers[layerIdx], count = ids.length;
    ids.forEach((id, pos) => {
      const node = graphState.nodes.find(n => n.id === id);
      if (!node) return;
      if (dir === 'TB') {
        const startX = MARGIN + (maxLayerW - (count*NODE_W+(count-1)*GAP_X))/2;
        node.x = Math.round(startX + pos*(NODE_W+GAP_X));
        node.y = MARGIN + li*(NODE_H+GAP_Y);
      } else {
        const startY = MARGIN + (maxLayerH - (count*NODE_H+(count-1)*GAP_Y))/2;
        node.x = MARGIN + li*(NODE_W+GAP_X);
        node.y = Math.round(startY + pos*(NODE_H+GAP_Y));
      }
    });
  });

  // 6. Zentrieren im Viewport
  const allX = graphState.nodes.map(n=>n.x), allY = graphState.nodes.map(n=>n.y);
  const minX=Math.min(...allX), maxX=Math.max(...allX)+NODE_W;
  const minY=Math.min(...allY), maxY=Math.max(...allY)+NODE_H;
  const vpW = (document.getElementById('canvas-wrapper')?.clientWidth  || 1200)/state.zoomLevel;
  const vpH = (document.getElementById('canvas-wrapper')?.clientHeight || 800) /state.zoomLevel;
  const offX=(vpW-(maxX-minX))/2-minX, offY=(vpH-(maxY-minY))/2-minY;
  graphState.nodes.forEach(n => { n.x=snapToGrid(Math.round(n.x+offX)); n.y=snapToGrid(Math.round(n.y+offY)); });

  // 7. Orthogonale Waypoints + Skip-Bypass (kompakt: nur bis hinter Zwischen-Layer)
  graphState.edges.forEach(edge => {
    const fn = graphState.nodes.find(n=>n.id===edge.from);
    const tn = graphState.nodes.find(n=>n.id===edge.to);
    if (!fn||!tn) return;
    edge.routing = 'straight';
    const srcRank = rank[fn.id]??0, tgtRank = rank[tn.id]??0;
    const isSkip  = Math.abs(tgtRank - srcRank) > 1;

    // Zwischen-Layer-Nodes (für kompakten Bypass-Abstand)
    const intermed = isSkip ? graphState.nodes.filter(n => {
      const r = rank[n.id]??0;
      return r > Math.min(srcRank,tgtRank) && r < Math.max(srcRank,tgtRank);
    }) : [];

    if (dir === 'TB') {
      const srcCX=Math.round(fn.x+NODE_W/2), tgtCX=Math.round(tn.x+NODE_W/2);
      const gutY   =Math.round(fn.y+NODE_H+GAP_Y/2);
      const tgtGutY=Math.round(tn.y-GAP_Y/2);
      if (!isSkip && Math.abs(srcCX-tgtCX)<=4) {
        edge.waypoints=[];
      } else if (!isSkip) {
        edge.waypoints=[{x:srcCX,y:gutY},{x:tgtCX,y:gutY}];
      } else {
        // Bypass rechts neben den Zwischen-Layer-Nodes
        const bypassX = intermed.length
          ? Math.max(...intermed.map(n=>n.x)) + NODE_W + Math.round(GAP_X*0.6)
          : Math.max(fn.x, tn.x) + NODE_W + Math.round(GAP_X*0.6);
        edge.waypoints=[{x:srcCX,y:gutY},{x:bypassX,y:gutY},{x:bypassX,y:tgtGutY},{x:tgtCX,y:tgtGutY}];
      }
    } else {
      const srcCY=Math.round(fn.y+NODE_H/2), tgtCY=Math.round(tn.y+NODE_H/2);
      const gutX   =Math.round(fn.x+NODE_W+GAP_X/2);
      const tgtGutX=Math.round(tn.x-GAP_X/2);
      if (!isSkip && Math.abs(srcCY-tgtCY)<=4) {
        edge.waypoints=[];
      } else if (!isSkip) {
        edge.waypoints=[{x:gutX,y:srcCY},{x:gutX,y:tgtCY}];
      } else {
        // Bypass unterhalb der Zwischen-Layer-Nodes
        const bypassY = intermed.length
          ? Math.max(...intermed.map(n=>n.y)) + NODE_H + Math.round(GAP_Y*0.6)
          : Math.max(fn.y, tn.y) + NODE_H + Math.round(GAP_Y*0.6);
        edge.waypoints=[{x:gutX,y:srcCY},{x:gutX,y:bypassY},{x:tgtGutX,y:bypassY},{x:tgtGutX,y:tgtCY}];
      }
    }
  });

  // 7b. Parallele Gutter-Kanten Y-staffeln (Kanten im selben Gutter auseinanderhalten)
  {
    const STEP=8, byGutter=new Map();
    graphState.edges.forEach(edge => {
      if (!edge.waypoints?.length) return;
      const key = dir==='LR' ? edge.waypoints[0].x : edge.waypoints[0].y;
      if (!byGutter.has(key)) byGutter.set(key,[]);
      byGutter.get(key).push(edge);
    });
    byGutter.forEach(group => {
      if (group.length<2) return;
      group.sort((a,b) => {
        const fa=graphState.nodes.find(n=>n.id===a.from), fb=graphState.nodes.find(n=>n.id===b.from);
        return dir==='LR' ? (fa?.y??0)-(fb?.y??0) : (fa?.x??0)-(fb?.x??0);
      });
      const base=-((group.length-1)*STEP)/2;
      group.forEach((edge,i) => {
        const o=Math.round(base+i*STEP);
        edge.waypoints=edge.waypoints.map(wp => dir==='LR'?{x:wp.x+o,y:wp.y}:{x:wp.x,y:wp.y+o});
      });
    });
  }


  // 8. Animiert DOM aktualisieren
  graphState.nodes.forEach(node => {
    const el = document.querySelector(`[data-id="${node.id}"]`);
    if (!el) return;
    el.style.transition='left .35s cubic-bezier(.4,0,.2,1), top .35s cubic-bezier(.4,0,.2,1)';
    el.style.left=node.x+'px'; el.style.top=node.y+'px';
  });
  setTimeout(() => {
    document.querySelectorAll('[data-id]').forEach(el => el.style.transition='');
    scheduleRedrawEdges();
  }, 370);

  logAudit('Auto-Layout', dir==='TB'?'Top → Bottom':'Left → Right');
  showToast(`Layout: ${dir==='TB'?'Top → Bottom':'Left → Right'}`, true);
}

// ── Layout-Dropdown ───────────────────────────────────────────────────────
function initLayoutDropdown() {
  const dropdown = document.getElementById('layout-dropdown');
  const dirBtn   = document.getElementById('btn-layout-dir');
  const mainBtn  = document.getElementById('btn-layout');
  const dirLabel = document.getElementById('layout-dir-label');

  const labelMap = { TB: '↓ TD', LR: '→ LR', GRID: '⊞ Grid' };
  const updateLabel = () => { if (dirLabel) dirLabel.textContent = labelMap[state.layoutDir] || state.layoutDir; };
  updateLabel();

  dirBtn?.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    lucide.createIcons({ nodes: [dropdown] });
  });

  document.querySelectorAll('.layout-dir-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.layoutDir = btn.dataset.dir;
      dropdown.style.display = 'none';
      updateLabel();
      autoLayout(state.layoutDir);
    });
  });

  mainBtn?.addEventListener('click', () => {
    if (state.layoutDir === 'GRID') state.layoutDir = 'TB';
    else state.layoutDir = state.layoutDir === 'TB' ? 'LR' : 'TB';
    updateLabel();
    autoLayout(state.layoutDir);
  });

  document.addEventListener('click', () => { dropdown.style.display = 'none'; });
}

// ── CMK Export ────────────────────────────────────────────────────────────
function exportCMK() {
  const packId    = prompt('Pack-ID:', 'ui4bi') ?? 'ui4bi';
  const packTitle = prompt('Pack-Titel:', 'UI4BI Export') ?? 'UI4BI Export';
  const pack = exportToCMK(graphState, packId.trim() || 'ui4bi', packTitle.trim() || 'UI4BI Export');
  const data = JSON.stringify(pack, null, 2);
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = `${packId}_bi_pack.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  logAudit('CMK BI Export', `Pack: ${packId}, ${pack.rules.length} Regeln, ${pack.aggregations.length} Aggregate`);
  showToast(`✓ CMK BI Pack exportiert: ${pack.rules.length} Regeln`, true);
}

// ── CMK Import ────────────────────────────────────────────────────────────
function importCMK() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const pack = JSON.parse(ev.target.result);
        if (!pack.rules && !pack.aggregations) throw new Error('Kein gültiges CMK BI Pack (rules/aggregations fehlen)');
        pushHistory();
        const { nodes, edges, nextId } = importFromCMK(pack);
        graphState.nodes  = nodes;
        graphState.edges  = edges;
        graphState.nextId = nextId;
        multiSelect.clear();
        fullRedraw();
        import('./toolbar.js').then(m => m.autoLayout('TB'));
        logAudit('CMK BI Import', `Pack: ${pack.id ?? file.name}, ${nodes.length} Nodes`);
        showToast(`✓ CMK Pack importiert: ${nodes.length} Nodes, ${edges.length} Kanten`, true);
      } catch (err) { showToast('CMK Import fehlgeschlagen: ' + err.message, false); }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ── Toolbar initialisieren ────────────────────────────────────────────────
export function initToolbar() {
  document.getElementById('btn-undo')?.addEventListener('click',     () => import('../core/actions.js').then(m => m.undo()));
  document.getElementById('btn-redo')?.addEventListener('click',     () => import('../core/actions.js').then(m => m.redo()));
  document.getElementById('btn-save')?.addEventListener('click',     saveGraph);
  document.getElementById('btn-validate')?.addEventListener('click', validateGraph);
  document.getElementById('btn-export')?.addEventListener('click',   exportJSON);
  document.getElementById('btn-import')?.addEventListener('click',   importJSON);
  document.getElementById('btn-cmk-export')?.addEventListener('click', exportCMK);
  document.getElementById('btn-cmk-import')?.addEventListener('click', importCMK);
  initSnapToggle();
  initLayoutDropdown();
}
