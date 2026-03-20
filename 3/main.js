// main.js – CMK BI Visual Editor Prototyp (verbesserte Edges + Aggregator-Typen)

const graphState = {
  nodes: [],
  edges: [],
  nextId: 1
};

let selectedNode = null;
let connectingFrom = null;
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStartX, panStartY;

const canvas = document.getElementById('canvas');
const inspector = document.getElementById('inspector');
const noSelection = document.getElementById('no-selection');
const zoomDisplay = document.getElementById('zoom-level');

// Aggregator-Typen (Check_MK BI Style)
const aggregatorTypes = [
  { value: 'and',       label: 'AND (alle müssen OK sein)' },
  { value: 'or',        label: 'OR (mindestens einer OK)' },
  { value: 'best',      label: 'Best state' },
  { value: 'worst',     label: 'Worst state' },
  { value: 'best_of_n', label: 'Best of N' },
  { value: 'worst_of_n',label: 'Worst of N' }
];

// Node-Typen (Palette)
const nodeTypes = [
  { type: 'aggregator', label: 'BI Aggregator', color: '#13d38e', icon: 'git-merge', shape: 'hexagon' },
  { type: 'host',       label: 'Host (Process)', color: '#A5D6A7', icon: 'server',    shape: 'rect'    },
  { type: 'service',    label: 'Service',        color: '#90A4AE', icon: 'activity', shape: 'parallelogram' }
];

// ── Hilfsfunktion: Mitte der Kante berechnen ───────────────────────────────
function getEdgePoint(node, targetNode) {
  const nx = node.x;
  const ny = node.y;
  const nw = 140;   // ungefähre Breite (anpassen falls Nodes unterschiedlich groß)
  const nh = 50;    // ungefähre Höhe

  const tx = targetNode.x;
  const ty = targetNode.y;

  // Relative Position bestimmen
  const dx = tx - nx;
  const dy = ty - ny;

  let px, py;

  // Sehr einfache, aber effektive Logik für 4 Hauptseiten
  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal dominiert → links oder rechts
    if (dx > 0) {
      px = nx + nw;     // rechte Kante
      py = ny + nh/2;
    } else {
      px = nx;          // linke Kante
      py = ny + nh/2;
    }
  } else {
    // Vertikal dominiert → oben oder unten
    if (dy > 0) {
      px = nx + nw/2;
      py = ny + nh;     // untere Kante
    } else {
      px = nx + nw/2;
      py = ny;          // obere Kante
    }
  }

  return { x: px, y: py };
}

// ── Node DOM-Element erstellen ──────────────────────────────────────────────
function createNodeElement(node) {
  const el = document.createElement('div');
  el.className = `
    absolute px-4 py-3 rounded-lg shadow-lg cursor-move select-none
    border-2 flex flex-col items-center justify-center text-center
    min-w-[140px] min-h-[50px] text-sm font-medium transition-all duration-150
  `;
  el.style.backgroundColor = `${node.color}15`;
  el.style.borderColor = node.color;
  el.style.color = '#ffffff';
  el.style.left = node.x + 'px';
  el.style.top  = node.y + 'px';
  el.dataset.id = node.id;
  el.draggable = true;

  if (node.type === 'aggregator') {
    el.classList.add('rounded-2xl', 'font-semibold');
  }

  el.innerHTML = `
    <i data-lucide="${node.icon}" class="w-6 h-6 mb-1.5"></i>
    <div class="font-semibold">${node.label}</div>
    ${node.aggType ? `<div class="text-xs opacity-80 mt-0.5">(${node.aggType.toUpperCase()})</div>` : ''}
  `;

  el.addEventListener('click', (e) => {
    e.stopPropagation();

    if (connectingFrom !== null) {
      if (connectingFrom !== node.id) {
        graphState.edges.push({ from: connectingFrom, to: node.id });
        redrawEdges();
        exitConnectMode();
      }
    } else {
      selectNode(node.id);
    }
  });

  el.addEventListener('mouseenter', () => {
    if (connectingFrom !== null && connectingFrom !== node.id) {
      el.classList.add('ring-2', 'ring-green-400', 'ring-offset-2', 'ring-offset-[#1a1a1a]', 'scale-105');
    }
  });
  el.addEventListener('mouseleave', () => {
    if (connectingFrom !== null) {
      el.classList.remove('ring-2', 'ring-green-400', 'ring-offset-2', 'ring-offset-[#1a1a1a]', 'scale-105');
    }
  });

  return el;
}

// ── Auswahl & Inspector ─────────────────────────────────────────────────────
function selectNode(id) {
  document.querySelectorAll('[data-id]').forEach(el => {
    el.classList.remove('ring-2', 'ring-white', 'ring-green-400', 'ring-offset-2', 'ring-offset-[#1a1a1a]', 'animate-pulse');
  });

  selectedNode = graphState.nodes.find(n => n.id === id);
  if (!selectedNode) return;

  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.classList.add('ring-2', 'ring-white', 'ring-offset-2', 'ring-offset-[#1a1a1a]');
  }

  updateInspector();
}

function updateInspector() {
  if (!selectedNode) {
    inspector.classList.add('hidden');
    noSelection.classList.remove('hidden');
    return;
  }

  inspector.classList.remove('hidden');
  noSelection.classList.add('hidden');

  let aggSection = '';
  if (selectedNode.type === 'aggregator') {
    const currentAgg = selectedNode.aggType || 'and';
    aggSection = `
      <div class="mt-4">
        <label class="block text-gray-400 mb-1">Aggregation-Typ</label>
        <select id="agg-type-select" class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e]">
          ${aggregatorTypes.map(opt => `
            <option value="${opt.value}" ${opt.value === currentAgg ? 'selected' : ''}>
              ${opt.label}
            </option>
          `).join('')}
        </select>
      </div>
    `;
  }

  inspector.innerHTML = `
    <div class="space-y-4 text-sm">
      <div>
        <label class="block text-gray-400 mb-1">Label</label>
        <input type="text" id="inp-label" value="${selectedNode.label || ''}"
               class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e]">
      </div>

      <div>
        <label class="block text-gray-400 mb-1">Typ</label>
        <div class="text-white">${selectedNode.type}</div>
      </div>

      ${aggSection}

      <div class="pt-2">
        <button id="btn-connect" class="w-full bg-[#13d38e] hover:bg-[#0fa678] text-black font-medium py-2 px-4 rounded transition">
          Mit anderem Knoten verbinden →
        </button>
      </div>

      <div class="text-xs text-gray-500 mt-3">
        ID: #${selectedNode.id}
      </div>
    </div>
  `;

  // Label ändern
  document.getElementById('inp-label')?.addEventListener('input', e => {
    selectedNode.label = e.target.value.trim() || selectedNode.type;
    const labelEl = document.querySelector(`[data-id="${selectedNode.id}"] div.font-semibold`);
    if (labelEl) labelEl.textContent = selectedNode.label;
  });

  // Aggregator-Typ ändern
  document.getElementById('agg-type-select')?.addEventListener('change', e => {
    selectedNode.aggType = e.target.value;
    // Node-UI aktualisieren
    const nodeEl = document.querySelector(`[data-id="${selectedNode.id}"]`);
    if (nodeEl) {
      const typeLine = nodeEl.querySelector('div.text-xs.opacity-80');
      if (typeLine) {
        typeLine.textContent = `(${e.target.value.toUpperCase()})`;
      } else {
        const newSpan = document.createElement('div');
        newSpan.className = 'text-xs opacity-80 mt-0.5';
        newSpan.textContent = `(${e.target.value.toUpperCase()})`;
        nodeEl.appendChild(newSpan);
      }
    }
  });

  document.getElementById('btn-connect')?.addEventListener('click', () => {
    if (selectedNode) enterConnectMode(selectedNode.id);
  });
}

// ── Connect-Modus ──────────────────────────────────────────────────────────
function enterConnectMode(fromId) {
  connectingFrom = fromId;
  const fromEl = document.querySelector(`[data-id="${fromId}"]`);
  if (fromEl) {
    fromEl.classList.add('ring-green-400', 'animate-pulse', 'ring-offset-2', 'ring-offset-[#1a1a1a]');
  }
  canvas.style.cursor = 'crosshair';
}

function exitConnectMode() {
  connectingFrom = null;
  canvas.style.cursor = 'default';
  document.querySelectorAll('[data-id]').forEach(el => {
    el.classList.remove('ring-green-400', 'animate-pulse', 'scale-105');
  });
  selectNode(selectedNode?.id);
}

// ── Drag & Drop aus Palette ────────────────────────────────────────────────
canvas.addEventListener('dragover', e => e.preventDefault());

canvas.addEventListener('drop', e => {
  e.preventDefault();
  if (connectingFrom !== null) return;

  const type = e.dataTransfer.getData('text/plain');
  if (!type) return;

  const template = nodeTypes.find(t => t.type === type);
  if (!template) return;

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - panX) / zoomLevel;
  const y = (e.clientY - rect.top - panY) / zoomLevel;

  const node = {
    id: graphState.nextId++,
    type,
    label: template.label,
    x: Math.round(x - 70),
    y: Math.round(y - 25),
    color: template.color,
    icon: template.icon,
    aggType: type === 'aggregator' ? 'and' : undefined
  };

  graphState.nodes.push(node);
  const el = createNodeElement(node);
  canvas.appendChild(el);
  makeDraggable(el);
  lucide.createIcons();
});

// ── Draggable ──────────────────────────────────────────────────────────────
function makeDraggable(el) {
  let pos = { x: 0, y: 0, startX: 0, startY: 0 };

  el.addEventListener('mousedown', evt => {
    if (evt.button !== 0 || connectingFrom !== null) return;
    evt.stopPropagation();

    selectNode(parseInt(el.dataset.id));

    pos.startX = evt.clientX;
    pos.startY = evt.clientY;
    pos.x = parseInt(el.style.left) || 0;
    pos.y = parseInt(el.style.top) || 0;

    const move = e => {
      const dx = e.clientX - pos.startX;
      const dy = e.clientY - pos.startY;
      el.style.left = (pos.x + dx) + 'px';
      el.style.top  = (pos.y + dy) + 'px';
      redrawEdges();
    };

    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      const id = parseInt(el.dataset.id);
      const node = graphState.nodes.find(n => n.id === id);
      if (node) {
        node.x = parseFloat(el.style.left) || node.x;
        node.y = parseFloat(el.style.top) || node.y;
      }
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

// ── Edges mit leichten Bézier-Kurven (orthogonal bevorzugt, Kollisionsvermeidung rudimentär) ──
function redrawEdges() {
  document.querySelectorAll('.edge-layer').forEach(el => el.remove());

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('edge-layer');
  svg.style.position = 'absolute';
  svg.style.inset = '0';
  svg.style.pointerEvents = 'none';
  svg.style.overflow = 'visible';
  canvas.appendChild(svg);

  graphState.edges.forEach(edge => {
    const fromNode = graphState.nodes.find(n => n.id === edge.from);
    const toNode   = graphState.nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return;

    const start = getEdgePoint(fromNode, toNode);
    const end   = getEdgePoint(toNode, fromNode);

    // ── Control Points für cubic Bézier berechnen ────────────────────────
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);

    // Basis-Abstand für Control-Points (ca. 30-50% der Distanz)
    let offset = Math.max(40, dist * 0.35);

    // Orthogonal bevorzugen → horizontal/vertikal → Control fast parallel
    let cp1x = start.x;
    let cp1y = start.y;
    let cp2x = end.x;
    let cp2y = end.y;

    if (Math.abs(dx) > Math.abs(dy) * 1.5) {
      // überwiegend horizontal → vertikale Auslenkung
      cp1x = start.x + dx * 0.33;
      cp1y = start.y + (dy > 0 ? offset : -offset);
      cp2x = end.x   - dx * 0.33;
      cp2y = end.y   + (dy > 0 ? offset : -offset);
    } else if (Math.abs(dy) > Math.abs(dx) * 1.5) {
      // überwiegend vertikal → horizontale Auslenkung
      cp1x = start.x + (dx > 0 ? offset : -offset);
      cp1y = start.y + dy * 0.33;
      cp2x = end.x   + (dx > 0 ? -offset : offset);
      cp2y = end.y   - dy * 0.33;
    } else {
      // diagonal → klassische S-Kurve
      cp1x = start.x + dx * 0.4;
      cp1y = start.y + dy * 0.2;
      cp2x = end.x   - dx * 0.4;
      cp2y = end.y   - dy * 0.2;
    }

    // ── Rudimentäre Kollisionsvermeidung ────────────────────────────────
    // Wenn ein anderer Knoten die gerade Linie kreuzt → stärker biegen
    const collides = graphState.nodes.some(n => {
      if (n.id === fromNode.id || n.id === toNode.id) return false;
      const nx = n.x, ny = n.y, nw = 140, nh = 60;
      // Sehr einfache Box-Intersection mit gerader Linie
      const t = ((nx - start.x) * dx + (ny - start.y) * dy) / (dx*dx + dy*dy);
      if (t < 0.1 || t > 0.9) return false;
      const ix = start.x + t * dx;
      const iy = start.y + t * dy;
      return ix > nx - 20 && ix < nx + nw + 20 && iy > ny - 20 && iy < ny + nh + 20;
    });

    if (collides) {
      // Bei potenzieller Kollision → stärker auslenken (z. B. +50%)
      offset *= 1.6;
      cp1y += dy > 0 ? offset * 0.6 : -offset * 0.6;
      cp2y += dy > 0 ? -offset * 0.6 : offset * 0.6;
    }

    // ── SVG Path mit cubic Bézier ───────────────────────────────────────
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 
      `M ${start.x},${start.y} ` +
      `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${end.x},${end.y}`
    );
    path.setAttribute('stroke', toNode.color || '#13d38e');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrow)');
    svg.appendChild(path);
  });

  // Pfeil-Definition (einmalig)
  if (!svg.querySelector('defs')) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="3" orient="auto">
        <path d="M0,0 L0,6 L10,3 z" fill="#13d38e" />
      </marker>
    `;
    svg.appendChild(defs);
  }
}

// ── Zoom & Pan ─────────────────────────────────────────────────────────────
function applyTransform() {
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
  redrawEdges();
  if (zoomDisplay) zoomDisplay.textContent = Math.round(zoomLevel * 100) + '%';
}

document.getElementById('zoom-in')?.addEventListener('click', () => {
  zoomLevel = Math.min(zoomLevel * 1.2, 4);
  applyTransform();
});

document.getElementById('zoom-out')?.addEventListener('click', () => {
  zoomLevel = Math.max(zoomLevel / 1.2, 0.25);
  applyTransform();
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  zoomLevel *= delta;
  zoomLevel = Math.max(0.25, Math.min(zoomLevel, 4));
  applyTransform();
});

// Pan
let spacePressed = false;
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !connectingFrom) {
    spacePressed = true;
    canvas.style.cursor = 'grab';
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') {
    spacePressed = false;
    canvas.style.cursor = connectingFrom ? 'crosshair' : 'default';
  }
});

canvas.addEventListener('mousedown', e => {
  if ((e.button === 1 || (e.button === 0 && spacePressed)) && !connectingFrom) {
    isPanning = true;
    panStartX = e.clientX - panX;
    panStartY = e.clientY - panY;
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
  }
});

document.addEventListener('mousemove', e => {
  if (!isPanning) return;
  panX = e.clientX - panStartX;
  panY = e.clientY - panStartY;
  applyTransform();
});

document.addEventListener('mouseup', () => {
  isPanning = false;
  canvas.style.cursor = connectingFrom ? 'crosshair' : (spacePressed ? 'grab' : 'default');
});

// ── Palette Drag ───────────────────────────────────────────────────────────
document.querySelectorAll('[draggable="true"]').forEach(item => {
  item.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', item.dataset.type);
  });
});

// ── Canvas-Klick → Auswahl aufheben ───────────────────────────────────────
canvas.addEventListener('click', e => {
  if (e.target === canvas || e.target.classList.contains('edge-layer')) {
    if (connectingFrom) {
      exitConnectMode();
    } else {
      selectedNode = null;
      document.querySelectorAll('[data-id]').forEach(el => {
        el.classList.remove('ring-2', 'ring-white', 'ring-offset-2', 'ring-offset-[#1a1a1a]');
      });
      updateInspector();
    }
  }
});

// ── Demo-Graph ─────────────────────────────────────────────────────────────
function loadDemoGraph() {
  const demo = [
    { id: 1, type: 'host', label: 'web-prod-01', x: 380, y: 250, color: '#A5D6A7', icon: 'server' },
    { id: 2, type: 'aggregator', label: 'Payment Agg', x: 680, y: 240, color: '#13d38e', icon: 'git-merge' },
    { id: 3, type: 'service', label: 'API Service', x: 520, y: 380, color: '#90A4AE', icon: 'activity' }
  ];

  demo.forEach(node => {
    graphState.nodes.push(node);
    const el = createNodeElement(node);
    canvas.appendChild(el);
    makeDraggable(el);
  });

  graphState.edges.push({ from: 1, to: 2 });
  graphState.edges.push({ from: 3, to: 2 });

  redrawEdges();
  lucide.createIcons();
}

// ── Init ───────────────────────────────────────────────────────────────────
// ── Init mit Demo ──────────────────────────────────────────────────────────
function loadDemoGraph() {
  const demo = [
    { id: 1, type: 'host',       label: 'web-prod-01', x: 320, y: 280, color: '#A5D6A7', icon: 'server' },
    { id: 2, type: 'aggregator', label: 'Frontend',    x: 620, y: 220, color: '#13d38e', icon: 'git-merge', aggType: 'best' },
    { id: 3, type: 'service',    label: 'HTTP Check',  x: 380, y: 420, color: '#90A4AE', icon: 'activity' },
    { id: 4, type: 'aggregator', label: 'Core',        x: 880, y: 300, color: '#13d38e', icon: 'git-merge', aggType: 'and' }
  ];

  demo.forEach(node => {
    graphState.nodes.push(node);
    const el = createNodeElement(node);
    canvas.appendChild(el);
    makeDraggable(el);
  });

  graphState.edges.push({ from: 1, to: 2 });
  graphState.edges.push({ from: 3, to: 2 });
  graphState.edges.push({ from: 2, to: 4 });

  redrawEdges();
  lucide.createIcons();
}

function init() {
  loadDemoGraph();
  lucide.createIcons();
  if (zoomDisplay) zoomDisplay.textContent = '100%';
}

init();