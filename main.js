// Minimal POC main.js — Vanilla JS, SVG canvas, mocked backend
const SVG_NS = 'http://www.w3.org/2000/svg';
const state = {
  currentRule: null,
  selection: { nodes: new Set(), edges: new Set() },
  history: { past: [], future: [] },
  settings: { gridSize: 16, snap: true, zoom: 1 },
  mode: null, // 'new-node' | 'new-edge' | null
  drag: null,
  temp: {}
};

const el = {
  canvas: document.getElementById('canvas'),
  btnNewNode: document.getElementById('btn-new-node'),
  btnNewEdge: document.getElementById('btn-new-edge'),
  btnDelete: document.getElementById('btn-delete'),
  btnUndo: document.getElementById('btn-undo'),
  btnRedo: document.getElementById('btn-redo'),
  btnSave: document.getElementById('btn-save'),
  btnImport: document.getElementById('btn-import'),
  btnExport: document.getElementById('btn-export'),
  ruleTitle: document.getElementById('rule-title'),
  ruleDesc: document.getElementById('rule-desc'),
  inspector: document.getElementById('inspector'),
  inspectorEmpty: document.getElementById('inspector-empty'),
  propLabel: document.getElementById('prop-label'),
  propSelector: document.getElementById('prop-selector'),
  propStates: document.getElementById('prop-states'),
  propColor: document.getElementById('prop-color'),
  propApply: document.getElementById('prop-apply'),
  propCancel: document.getElementById('prop-cancel'),
  status: document.getElementById('status'),
  fileInput: document.getElementById('file-input')
};

function setStatus(s){ el.status.textContent = s; }
function uid(prefix){ return prefix + '-' + Math.random().toString(36).slice(2,9); }

// --- Renderer ---
function clearCanvas(){
  while(el.canvas.firstChild) el.canvas.removeChild(el.canvas.firstChild);
  // defs for arrow
  const defs = document.createElementNS(SVG_NS,'defs');
  defs.innerHTML = `<marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">
    <path d="M0,0 L10,5 L0,10 z" fill="#444"></path></marker>`;
  el.canvas.appendChild(defs);
  // groups
  ['grid','edges','nodes','overlay'].forEach(id=>{
    const g = document.createElementNS(SVG_NS,'g');
    g.setAttribute('id', id);
    el.canvas.appendChild(g);
  });
}

function renderAll(){
  clearCanvas();
  renderGrid();
  if(!state.currentRule) return;
  renderEdges();
  renderNodes();
  renderSelection();
}

function renderGrid(){
  const g = el.canvas.querySelector('#grid');
  const gs = state.settings.gridSize;
  const w = el.canvas.clientWidth, h = el.canvas.clientHeight;
  const lines = [];
  for(let x=0; x<w; x+=gs) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${getComputedStyle(document.documentElement).getPropertyValue('--grid')}" stroke-width="1"/>`);
  for(let y=0; y<h; y+=gs) lines.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${getComputedStyle(document.documentElement).getPropertyValue('--grid')}" stroke-width="1"/>`);
  g.innerHTML = lines.join('');
}

function renderNodes(){
  const g = el.canvas.querySelector('#nodes');
  state.currentRule.nodes.forEach(node=>{
    const ng = document.createElementNS(SVG_NS,'g');
    ng.classList.add('node');
    ng.dataset.id = node.id;
    // rect
    const rect = document.createElementNS(SVG_NS,'rect');
    rect.setAttribute('x', node.x);
    rect.setAttribute('y', node.y);
    rect.setAttribute('width', node.w);
    rect.setAttribute('height', node.h);
    rect.setAttribute('rx', 6);
    rect.style.fill = node.color || getComputedStyle(document.documentElement).getPropertyValue('--node-fill');
    ng.appendChild(rect);
    // text
    const text = document.createElementNS(SVG_NS,'text');
    text.setAttribute('x', node.x + 10);
    text.setAttribute('y', node.y + 26);
    text.textContent = node.label;
    ng.appendChild(text);
    // ports
    ['top','right','bottom','left'].forEach(side => {
      const p = portPosition(node, side);
      const port = document.createElementNS(SVG_NS,'circle');
      port.classList.add('port', side);
      port.setAttribute('cx', p.x);
      port.setAttribute('cy', p.y);
      port.setAttribute('r', 4);
      ng.appendChild(port);
    });
    // events
    ng.addEventListener('mousedown', nodeMouseDown);
    ng.addEventListener('dblclick', nodeDblClick);
    g.appendChild(ng);
  });
}

function renderEdges(){
  const g = el.canvas.querySelector('#edges');
  state.currentRule.edges.forEach(edge=>{
    const path = document.createElementNS(SVG_NS,'path');
    path.classList.add('edge');
    path.dataset.id = edge.id;
    const s = getNode(edge.sourceId), t = getNode(edge.targetId);
    if(!s || !t) return;
    const p1 = midPoint(s, t);
    const d = buildEdgePath(s, t, edge.waypoints || []);
    path.setAttribute('d', d);
    path.addEventListener('mousedown', edgeMouseDown);
    g.appendChild(path);
  });
}

function renderSelection(){
  // mark selected nodes
  el.canvas.querySelectorAll('.node').forEach(nEl=>{
    const id = nEl.dataset.id;
    if(state.selection.nodes.has(id)) nEl.classList.add('selected'); else nEl.classList.remove('selected');
  });
  // selected edges: stroke highlight
  el.canvas.querySelectorAll('.edge').forEach(eEl=>{
    const id = eEl.dataset.id;
    if(state.selection.edges.has(id)) eEl.classList.add('selected'); else eEl.classList.remove('selected');
  });
}

// --- Geometry helpers ---
function getNode(id){ return state.currentRule.nodes.find(n=>n.id===id); }
function portPosition(node, side){
  if(side==='top') return {x: node.x + node.w/2, y: node.y};
  if(side==='right') return {x: node.x + node.w, y: node.y + node.h/2};
  if(side==='bottom') return {x: node.x + node.w/2, y: node.y + node.h};
  return {x: node.x, y: node.y + node.h/2};
}
function midPoint(a,b){ return {x: (a.x + b.x + b.w)/2, y: (a.y + b.y + b.h)/2}; }
function buildEdgePath(s,t,waypoints){
  const sx = s.x + s.w/2, sy = s.y + s.h/2;
  const tx = t.x + t.w/2, ty = t.y + t.h/2;
  if(!waypoints || waypoints.length===0){
    // simple cubic curve
    const cx1 = sx + (tx - sx)*0.3, cy1 = sy;
    const cx2 = sx + (tx - sx)*0.7, cy2 = ty;
    return `M ${sx} ${sy} C ${cx1} ${cy1} ${cx2} ${cy2} ${tx} ${ty}`;
  } else {
    let d = `M ${sx} ${sy}`;
    waypoints.forEach(p => d += ` L ${p.x} ${p.y}`);
    d += ` L ${tx} ${ty}`;
    return d;
  }
}

// --- Interaction handlers ---
function nodeMouseDown(ev){
  ev.stopPropagation();
  const nodeEl = ev.currentTarget;
  const id = nodeEl.dataset.id;
  const node = getNode(id);
  state.drag = { type:'node', id, startX: ev.clientX, startY: ev.clientY, origX: node.x, origY: node.y };
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function nodeDblClick(ev){
  ev.stopPropagation();
  const id = ev.currentTarget.dataset.id;
  selectOnlyNode(id);
  openInspectorForNode(getNode(id));
  // inline edit could be added
}

function edgeMouseDown(ev){
  ev.stopPropagation();
  const id = ev.currentTarget.dataset.id;
  toggleSelectionEdge(id);
}

function onMouseMove(ev){
  if(!state.drag) return;
  if(state.drag.type==='node'){
    const node = getNode(state.drag.id);
    const dx = (ev.clientX - state.drag.startX) / state.settings.zoom;
    const dy = (ev.clientY - state.drag.startY) / state.settings.zoom;
    let nx = state.drag.origX + dx;
    let ny = state.drag.origY + dy;
    if(state.settings.snap){
      nx = Math.round(nx / state.settings.gridSize) * state.settings.gridSize;
      ny = Math.round(ny / state.settings.gridSize) * state.settings.gridSize;
    }
    node.x = nx; node.y = ny;
    renderAll();
  }
}

function onMouseUp(ev){
  if(!state.drag) return;
  if(state.drag.type==='node'){
    pushHistory({type:'move_node', id: state.drag.id, from:{x:state.drag.origX,y:state.drag.origY}, to:{x:getNode(state.drag.id).x,y:getNode(state.drag.id).y}});
  }
  state.drag = null;
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
}

// Canvas clicks
el.canvas.addEventListener('mousedown', e=>{
  // click on empty canvas clears selection unless shift held
  if(!e.shiftKey) clearSelection();
  renderAll();
});

// --- Selection helpers ---
function selectOnlyNode(id){
  state.selection.nodes.clear(); state.selection.edges.clear();
  state.selection.nodes.add(id);
  renderAll();
  openInspectorForNode(getNode(id));
}
function toggleSelectionEdge(id){
  if(state.selection.edges.has(id)) state.selection.edges.delete(id); else state.selection.edges.add(id);
  renderAll();
}
function clearSelection(){
  state.selection.nodes.clear(); state.selection.edges.clear();
  hideInspector();
}

// --- Inspector UI ---
function openInspectorForNode(node){
  if(!node) return;
  el.inspector.classList.remove('hidden'); el.inspectorEmpty.classList.add('hidden');
  el.propLabel.value = node.label;
  el.propSelector.value = node.selector || '';
  el.propStates.value = (node.states || []).join(',');
  el.propColor.value = node.color || '#ffffff';
  el.temp.inspectorNode = node.id;
}
function hideInspector(){
  el.inspector.classList.add('hidden'); el.inspectorEmpty.classList.remove('hidden');
  delete el.temp.inspectorNode;
}
el.propApply.addEventListener('click', ()=>{
  const id = el.temp.inspectorNode; if(!id) return;
  const node = getNode(id);
  node.label = el.propLabel.value || node.label;
  node.selector = el.propSelector.value || node.selector;
  node.states = el.propStates.value.split(',').map(s=>s.trim()).filter(Boolean);
  node.color = el.propColor.value;
  pushHistory({type:'edit_node', id, before:null, after:null}); // simplified history entry
  renderAll(); hideInspector();
});
el.propCancel.addEventListener('click', hideInspector);

// --- Toolbar actions ---
el.btnNewNode.addEventListener('click', ()=>{ state.mode = 'new-node'; setStatus('Click canvas to place new node'); });
el.btnNewEdge.addEventListener('click', ()=>{ state.mode = 'new-edge'; setStatus('Drag from node port to create edge'); });
el.btnDelete.addEventListener('click', deleteSelection);
el.btnUndo.addEventListener('click', undo);
el.btnRedo.addEventListener('click', redo);
el.btnSave.addEventListener('click', saveRule);
el.btnImport.addEventListener('click', ()=> el.fileInput.click());
el.btnExport.addEventListener('click', exportRule);
el.fileInput.addEventListener('change', importFromFile);

// keyboard
window.addEventListener('keydown', (e)=>{
  if(e.key==='n' || e.key==='N') el.btnNewNode.click();
  if(e.key==='e' || e.key==='E') el.btnNewEdge.click();
  if((e.ctrlKey || e.metaKey) && e.key==='z'){ e.preventDefault(); undo(); }
  if((e.ctrlKey || e.metaKey) && e.key==='y'){ e.preventDefault(); redo(); }
  if(e.key==='Delete') deleteSelection();
  if(e.key==='s' || e.key==='S'){ e.preventDefault(); saveRule(); }
});

// place new node on canvas click
el.canvas.addEventListener('click', ev=>{
  if(state.mode === 'new-node'){
    const rect = el.canvas.getBoundingClientRect();
    const x = Math.round((ev.clientX - rect.left)/state.settings.gridSize)*state.settings.gridSize;
    const y = Math.round((ev.clientY - rect.top)/state.settings.gridSize)*state.settings.gridSize;
    const node = { id: uid('n'), label:'New Node', selector:'', type:'service', x,y,w:160,h:56,color:'#fff59d',states:[],aggregation:'majority' };
    state.currentRule.nodes.push(node);
    pushHistory({type:'create_node', id: node.id});
    state.mode = null; setStatus('Node created');
    renderAll();
  }
});

// delete selection
function deleteSelection(){
  const nodes = Array.from(state.selection.nodes);
  const edges = Array.from(state.selection.edges);
  if(nodes.length===0 && edges.length===0) return;
  // remove edges connected to nodes
  state.currentRule.edges = state.currentRule.edges.filter(e=> !edges.includes(e.id) && !nodes.includes(e.sourceId) && !nodes.includes(e.targetId));
  state.currentRule.nodes = state.currentRule.nodes.filter(n=> !nodes.includes(n.id));
  pushHistory({type:'delete', nodes, edges});
  clearSelection(); renderAll();
}

// --- History (simple) ---
function pushHistory(action){
  state.history.past.push(action);
  state.history.future = [];
  // limit depth
  if(state.history.past.length>200) state.history.past.shift();
}
function undo(){
  const act = state.history.past.pop();
  if(!act) return;
  state.history.future.push(act);
  // very basic: on undo reload from latest saved or reload demo — for POC just notify
  setStatus('Undo (POC: action recorded, no full revert implementation)');
}
function redo(){
  const act = state.history.future.pop();
  if(!act) return;
  state.history.past.push(act);
  setStatus('Redo (POC)');
}

// --- Persistence ---
async function loadInitial(){
  const rules = await MockBackend.listRules();
  const rule = rules[0];
  state.currentRule = JSON.parse(JSON.stringify(rule)); // copy
  el.ruleTitle.value = state.currentRule.title || '';
  el.ruleDesc.value = state.currentRule.description || '';
  renderAll();
}
async function saveRule(){
  if(!state.currentRule) return;
  setStatus('Saving...');
  state.currentRule.title = el.ruleTitle.value;
  state.currentRule.description = el.ruleDesc.value;
  const res = await MockBackend.createOrUpdateRule(state.currentRule);
  state.currentRule.version = res.version;
  setStatus('Saved (v'+res.version+')');
}
async function exportRule(){
  if(!state.currentRule) return;
  const data = JSON.stringify(state.currentRule, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = (state.currentRule.id||'rule')+'.json'; a.click();
  URL.revokeObjectURL(url);
}
function importFromFile(ev){
  const f = ev.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = e=>{
    try{
      const j = JSON.parse(e.target.result);
      state.currentRule = j;
      el.ruleTitle.value = j.title || '';
      el.ruleDesc.value = j.description || '';
      renderAll();
      setStatus('Imported file');
    }catch(err){ setStatus('Import failed: invalid JSON'); }
  };
  r.readAsText(f);
  ev.target.value = '';
}

// --- Init ---
window.addEventListener('load', ()=>{ loadInitial(); setStatus('Ready'); });
