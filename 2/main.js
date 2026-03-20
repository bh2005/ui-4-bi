// main.js – ES‑Module, bindet das Mock‑Backend ein und implementiert Drag, Edge‑Drawing, History usw.

import MockBackend from './mock-backend.js';
const api = MockBackend;               // später durch echten Adapter ersetzbar

document.addEventListener('DOMContentLoaded', async () => {
  // ---------- DOM‑Referenzen ----------
  const svgCanvas      = document.getElementById('canvas');
  const newNodeButton  = document.getElementById('btn-new-node');
  const newEdgeButton  = document.getElementById('btn-new-edge');
  const deleteButton   = document.getElementById('btn-delete');
  const undoButton     = document.getElementById('btn-undo');
  const redoButton     = document.getElementById('btn-redo');
  const saveButton     = document.getElementById('btn-save');
  const importButton   = document.getElementById('btn-import');
  const exportButton   = document.getElementById('btn-export');
  const fileInput      = document.getElementById('file-input');
  const status         = document.getElementById('status');
  const propLabel      = document.getElementById('prop-label');
  const propSelector   = document.getElementById('prop-selector');
  const propStates     = document.getElementById('prop-states');
  const propColor      = document.getElementById('prop-color');
  const propApply      = document.getElementById('prop-apply');
  const propCancel     = document.getElementById('prop-cancel');
  const inspector      = document.getElementById('inspector');
  const inspectorEmpty = document.getElementById('inspector-empty');

  // ---------- App‑State ----------
  const state = {
    currentRule: null,
    selection: { nodes: new Set(), edges: new Set() },
    history: { past: [], future: [] },
    settings: { gridSize: 20, snap: true, zoom: 1 },
  };

  // ---------- Hilfs‑Funktionen ----------
  function setStatus(msg, level = 'info') {
    status.textContent = msg;
    status.style.color = {
      info: 'var(--muted)',
      ok:   'var(--status-ok)',
      warn: 'var(--status-warning)',
      err:  'var(--status-critical)'
    }[level];
  }

  function pushHistory(entry) {
    state.history.past.push(entry);
    state.history.future = [];
  }

  // ---------- SVG‑Layers ----------
  function initLayers() {
    const ns = 'http://www.w3.org/2000/svg';
    ['grid', 'edges', 'nodes', 'overlay'].forEach(id => {
      let g = document.getElementById(id);
      if (!g) {
        g = document.createElementNS(ns, 'g');
        g.id = id;
        svgCanvas.appendChild(g);
      }
    });
  }

  function drawGrid() {
    const ns = 'http://www.w3.org/2000/svg';
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    const size = state.settings.gridSize;
    const view = svgCanvas.viewBox.baseVal;
    const cols = Math.ceil(view.width / size);
    const rows = Math.ceil(view.height / size);
    for (let i = 0; i <= cols; i++) {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', i * size);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', i * size);
      line.setAttribute('y2', view.height);
      line.setAttribute('stroke', 'var(--grid)');
      line.setAttribute('stroke-width', 0.5);
      grid.appendChild(line);
    }
    for (let j = 0; j <= rows; j++) {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', j * size);
      line.setAttribute('x2', view.width);
      line.setAttribute('y2', j * size);
      line.setAttribute('stroke', 'var(--grid)');
      line.setAttribute('stroke-width', 0.5);
      grid.appendChild(line);
    }
  }

  function applyViewport() {
    const { zoom, panX, panY } = state.currentRule.ui_meta;
    const w = svgCanvas.clientWidth / zoom;
    const h = svgCanvas.clientHeight / zoom;
    svgCanvas.setAttribute('viewBox', `${-panX} ${-panY} ${w} ${h}`);
    state.settings.zoom = zoom;
  }

  // ---------- Rendering ----------
  function renderGraph() {
    document.getElementById('nodes').innerHTML = '';
    document.getElementById('edges').innerHTML = '';
    state.currentRule.nodes.forEach(renderNode);
    state.currentRule.edges.forEach(renderEdge);
    applyViewport();
  }

  function renderNode(node) {
    const g = createNodeElement(node);
    document.getElementById('nodes').appendChild(g);
  }

  function renderEdge(edge) {
    const ns = 'http://www.w3.org/2000/svg';
    const src = state.currentRule.nodes.find(n => n.id === edge.sourceId);
    const tgt = state.currentRule.nodes.find(n => n.id === edge.targetId);
    if (!src || !tgt) return;

    // einfacher orthogonaler Elbow‑Route
    const sx = src.x + src.w;               // rechter Port
    const sy = src.y + src.h / 2;
    const tx = tgt.x;                       // linker Port
    const ty = tgt.y + tgt.h / 2;
    const d = `M ${sx} ${sy} L ${sx + 20} ${sy} L ${sx + 20} ${ty} L ${tx} ${ty}`;

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'edge');
    path.dataset.id = edge.id;
    document.getElementById('edges').appendChild(path);
  }

  // ---------- Node‑Element erzeugen ----------
  function createNodeElement(node) {
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.classList.add('node', node.status || 'unknown');
    g.dataset.id = node.id;

    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', node.x);
    rect.setAttribute('y', node.y);
    rect.setAttribute('width', node.w);
    rect.setAttribute('height', node.h);
    rect.setAttribute('rx', 6);
    rect.setAttribute('ry', 6);
    rect.setAttribute('fill', node.color || 'var(--node-fill)');
    g.appendChild(rect);

    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', node.x + 10);
    text.setAttribute('y', node.y + 24);
    text.textContent = node.label;
    g.appendChild(text);

    // Ports (top/right/bottom/left)
    ['top', 'right', 'bottom', 'left'].forEach(side => {
      const port = document.createElementNS(ns, 'circle');
      const p = portPosition(node, side);
      port.setAttribute('cx', p.x);
      port.setAttribute('cy', p.y);
      port.setAttribute('r', 4);
      port.classList.add('port', side);
      g.appendChild(port);
    });

    return g;
  }

  function portPosition(node, side) {
    const x = node.x + (side === 'right' ? node.w : side === 'left' ? 0 : node.w / 2);
    const y = node.y + (side === 'bottom' ? node.h : side === 'top' ? 0 : node.h / 2);
    return { x, y };
  }

  // ---------- Auswahl & Inspector ----------
  function selectElement(type, id) {
    // clear previous selection
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    state.selection.nodes.clear();
    state.selection.edges.clear();

    const g = document.querySelector(`g[data-id="${id}"]`);
    if (g) g.classList.add('selected');

    if (type === 'node') {
      state.selection.nodes.add(id);
      const node = state.currentRule.nodes.find(n => n.id === id);
      propLabel.value    = node.label;
      propSelector.value = node.selector;
      propStates.value   = node.states.join(', ');
      propColor.value    = node.color || '#f7c';
      inspector.classList.remove('hidden');
      inspectorEmpty.classList.add('hidden');
    } else {
      inspector.classList.add('hidden');
      inspectorEmpty.classList.remove('hidden');
    }
  }

  // ---------- Drag‑&‑Drop für Nodes ----------
  let drag = null;
  svgCanvas.addEventListener('mousedown', e => {
    const nodeEl = e.target.closest('.node');
    if (!nodeEl) return;
    const id = nodeEl.dataset.id;
    const node = state.currentRule.nodes.find(n => n.id === id);
    drag = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: node.x,
      origY: node.y
    };
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
  });

  function onDrag(e) {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / state.settings.zoom;
    const dy = (e.clientY - drag.startY) / state.settings.zoom;
    const node = state.currentRule.nodes.find(n => n.id === drag.id);
    const snap = state.settings.snap ? state.settings.gridSize : 0;
    node.x = snap ? Math.round((drag.origX + dx) / snap) * snap : drag.origX + dx;
    node.y = snap ? Math.round((drag.origY + dy) / snap) * snap : drag.origY + dy;
    renderNode(node);
  }

  function endDrag() {
    if (!drag) return;
    const node = state.currentRule.nodes.find(n => n.id === drag.id);
    pushHistory({
      apply: () => {}, // bereits ausgeführt
      inverse: () => {
        node.x = drag.origX;
        node.y = drag.origY;
        renderNode(node);
      }
    });
    drag = null;
  }

  // ---------- Edge‑Drawing ----------
  let edgeDraft = null; // { sourceId, lineEl }
  newEdgeButton.addEventListener('click', () => {
    setStatus('Klicken Sie auf einen Quell‑Port, dann auf einen Ziel‑Port.', 'info');
    svgCanvas.classList.add('edge-drawing');
  });

  // Starten des Edge‑Drafts beim Klick auf einen Port
  svgCanvas.addEventListener('mousedown', e => {
    if (!svgCanvas.classList.contains('edge-drawing')) return;
    const port = e.target.closest('.port');
    if (!port) return;

    const nodeEl = port.closest('.node');
    const nodeId = nodeEl.dataset.id;
    const side   = port.classList.contains('top')   ? 'top' :
                   port.classList.contains('right') ? 'right' :
                   port.classList.contains('bottom')? 'bottom' : 'left';

    const start = portPosition(state.currentRule.nodes.find(n => n.id === nodeId), side);
    const ns = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', start.x);
    line.setAttribute('y1', start.y);
    line.setAttribute('x2', start.x);
    line.setAttribute('y2', start.y);
    line.setAttribute('stroke', 'var(--edge-draft)');
    line.setAttribute('stroke-width', 2);
    line.classList.add('edge-draft');
    document.getElementById('overlay').appendChild(line);

    edgeDraft = { sourceId: nodeId, sourceSide: side, lineEl: line };
    window.addEventListener('mousemove', updateEdgeDraft);
    window.addEventListener('mouseup', finishEdgeDraft);
  });

  function updateEdgeDraft(e) {
    if (!edgeDraft) return;
    const pt = svgCanvas.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgCanvas.getScreenCTM().inverse());
    edgeDraft.lineEl.setAttribute('x2', svgP.x);
    edgeDraft.lineEl.setAttribute('y2', svgP.y);
  }

  function finishEdgeDraft(e) {
    if (!edgeDraft) return;
    const targetPort = e.target.closest('.port');
    if (!targetPort) {
      // Abbruch – kein Ziel‑Port
      edgeDraft.lineEl.remove();
      cleanupEdgeDraft();
      setStatus('Edge‑Zeichnen abgebrochen.', 'warn');
      return;
    }

    const targetNodeEl = targetPort.closest('.node');
    const targetId = targetNodeEl.dataset.id;
    const targetSide = targetPort.classList.contains('top')   ? 'top' :
                       targetPort.classList.contains('right') ? 'right' :
                       targetPort.classList.contains('bottom')? 'bottom' : 'left';

    // Verhindere Selbst‑Loops
    if (edgeDraft.sourceId === targetId) {
      edgeDraft.lineEl.remove();
      cleanupEdgeDraft();
      setStatus('Selbst‑Loops sind nicht erlaubt.', 'warn');
      return;
    }

    // Erstelle Edge‑Objekt
    const newEdge = {
      id: `e${Date.now()}`, // simple unique id
      sourceId: edgeDraft.sourceId,
      targetId: targetId,
      sourceSide: edgeDraft.sourceSide,
      targetSide: targetSide,
      label: '',
      style: {}
    };
    state.currentRule.edges.push(newEdge);
    renderEdge(newEdge);
    pushHistory({
      apply: () => {
        state.currentRule.edges.push(newEdge);
        renderEdge(newEdge);
      },
      inverse: () => {
        state.currentRule.edges = state.currentRule.edges.filter(e => e.id !== newEdge.id);
        document.querySelector(`path[data-id="${newEdge.id}"]`).remove();
      }
    });

    edgeDraft.lineEl.remove();
    cleanupEdgeDraft();
    setStatus('Edge erstellt.', 'ok');
  }

  function cleanupEdgeDraft() {
    window.removeEventListener('mousemove', updateEdgeDraft);
    window.removeEventListener('mouseup', finishEdgeDraft);
    edgeDraft = null;
    svgCanvas.classList.remove('edge-drawing');
  }

  // ---------- Neuer Node‑Button ----------
  newNodeButton.addEventListener('click', () => {
    const view = svgCanvas.viewBox.baseVal;
    const cx = view.x + view.width / 2;
    const cy = view.y + view.height / 2;

    const newNode = {
      id: `n${Date.now()}`,
      x: cx - 60,               // zentriert (Breite 120)
      y: cy - 25,               // zentriert (Höhe 50)
      w: 120,
      h: 50,
      label: 'Neuer Node',
      selector: '',
      states: [],
      color: '#c7eaff',
      status: 'unknown'
    };

    state.currentRule.nodes.push(newNode);
    renderNode(newNode);
    pushHistory({
      apply: () => {
        state.currentRule.nodes.push(newNode);
        renderNode(newNode);
      },
      inverse: () => {
        state.currentRule.nodes = state.currentRule.nodes.filter(n => n.id !== newNode.id);
        document.querySelector(`g[data-id="${newNode.id}"]`).remove();
      }
    });
    setStatus('Node erstellt.', 'ok');
  });

  // ---------- Undo / Redo ----------
  undoButton.addEventListener('click', () => {
    const entry = state.history.past.pop();
    if (!entry) {
      setStatus('Nichts zum Rückgängig‑Machen.', 'warn');
      return;
    }
    entry.inverse();
    state.history.future.push(entry);
    setStatus('Rückgängig gemacht.', 'ok');
  });

  redoButton.addEventListener('click', () => {
    const entry = state.history.future.pop();
    if (!entry) {
      setStatus('Nichts zum Wiederherstellen.', 'warn');
      return;
    }
    entry.apply();
    state.history.past.push(entry);
    setStatus('Wiederhergestellt.', 'ok');
  });

  // ---------- Delete ----------
  deleteButton.addEventListener('click', () => {
    const toDeleteNodes = [...state.selection.nodes];
    const toDeleteEdges = [...state.selection.edges];

    // Entferne Kanten, die zu gelöschten Nodes gehören
    const affectedEdges = state.currentRule.edges.filter(
      e => toDeleteNodes.includes(e.sourceId) || toDeleteNodes.includes(e.targetId)
    );
    const allEdges = [...toDeleteEdges, ...affectedEdges.map(e => e.id)];

    // Historieneintrag vorbereiten
    const removedNodes = state.currentRule.nodes.filter(n => toDeleteNodes.includes(n.id));
    const removedEdges = state.currentRule.edges.filter(e => allEdges.includes(e.id));

    pushHistory({
      apply: () => {
        state.currentRule.nodes = state.currentRule.nodes.filter(n => !toDeleteNodes.includes(n.id));
        state.currentRule.edges = state.currentRule.edges.filter(e => !allEdges.includes(e.id));
        renderGraph();
      },
      inverse: () => {
        state.currentRule.nodes.push(...removedNodes);
        state.currentRule.edges.push(...removedEdges);
        renderGraph();
      }
    });

    // Sofort ausführen
    state.currentRule.nodes = state.currentRule.nodes.filter(n => !toDeleteNodes.includes(n.id));
    state.currentRule.edges = state.currentRule.edges.filter(e => !allEdges.includes(e.id));
    renderGraph();
    setStatus('Auswahl gelöscht.', 'ok');
    state.selection.nodes.clear();
    state.selection.edges.clear();
  });

  // ---------- Save / Export ----------
  saveButton.addEventListener('click', async () => {
    try {
      await api.saveRule(state.currentRule);
      setStatus('Regel gespeichert.', 'ok');
    } catch (err) {
      setStatus(`Speichern fehlgeschlagen: ${err.message}`, 'err');
    }
  });

  exportButton.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.currentRule, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.currentRule.id || 'rule'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exportiert.', 'ok');
  });

  // ---------- Import ----------
  importButton.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        state.currentRule = imported;
        renderGraph();
        setStatus('Import erfolgreich.', 'ok');
      } catch (err) {
        setStatus(`Import‑Fehler: ${err.message}`, 'err');
      }
    };
    reader.readAsText(file);
  });

  // ---------- Inspector – Änderungen übernehmen ----------
  propApply.addEventListener('click', () => {
    const nodeId = [...state.selection.nodes][0];
    const node = state.currentRule.nodes.find(n => n.id === nodeId);
    const old = {...node};

    node.label    = propLabel.value;
    node.selector = propSelector.value;
    node.states   = propStates.value.split(',').map(s => s.trim()).filter(Boolean);
    node.color    = propColor.value;

    pushHistory({
      apply: () => {
        Object.assign(node, {
          label: propLabel.value,
          selector: propSelector.value,
          states: node.states,
          color: propColor.value
        });
        renderNode(node);
      },
      inverse: () => {
        Object.assign(node, old);
        renderNode(node);
      }
    });

    renderNode(node);
    setStatus('Eigenschaften übernommen.', 'ok');
  });

  propCancel.addEventListener('click', () => {
    // Reset UI to aktuelle Node‑Werte
    const nodeId = [...state.selection.nodes][0];
    const node = state.currentRule.nodes.find(n => n.id === nodeId);
    propLabel.value    = node.label;
    propSelector.value = node.selector;
    propStates.value   = node.states.join(', ');
    propColor.value    = node.color || '#f7c';
    setStatus('Änderungen verworfen.', 'info');
  });

  // ---------- Initialisierung ----------
  initLayers();
  drawGrid();

  // Beispiel‑Daten laden (kann später durch API‑Aufruf ersetzt werden)
  state.currentRule = await api.loadRule('example');

  // ---- Sicherstellen, dass ui_meta existiert ----
  if (!state.currentRule.ui_meta) {
    state.currentRule.ui_meta = { zoom: 1, panX: 0, panY: 0 };
  }

  // ---- Demo‑Node, falls keine Nodes vorhanden ----
  if (!state.currentRule.nodes || state.currentRule.nodes.length === 0) {
    const demoNode = {
      id: 'n-demo',
      x: 100,
      y: 100,
      w: 120,
      h: 50,
      label: 'Demo‑Node',
      selector: '',
      states: [],
      color: '#ffcc80',
      status: 'unknown'
    };
    state.currentRule.nodes = [demoNode];
  }

  // 4️⃣ **Initiales viewBox setzen**, falls das SVG noch keins hat
  if (!svgCanvas.hasAttribute('viewBox')) {
    // Start‑Viewport: 0 0 800 600 (passt zu den Demo‑Koordinaten)
    svgCanvas.setAttribute('viewBox', `0 0 ${svgCanvas.clientWidth} ${svgCanvas.clientHeight}`);
  }

  // 5️⃣ Viewport‑Parameter aus ui_meta anwenden (setzt das viewBox korrekt)
  applyViewport();

  // 6️⃣ Jetzt erst rendern – Nodes liegen im korrekten Koordinatensystem
  renderGraph();

  setStatus('Bereit.', 'ok');
});

