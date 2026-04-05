import { graphState, state, multiSelect, history, inspector, noSelection } from '../core/state.js';
import { aggregatorTypes } from '../core/constants.js';
import { deleteSelected, alignNodes, enterConnectMode } from '../core/actions.js';
import { scheduleRedrawEdges } from '../renderer/renderer.js';

// ── Autocomplete-Cache (API oder Mock) ───────────────────────────────────
const _cache = {};

async function _fetchSuggestions(endpoint, mockData) {
  if (_cache[endpoint]) return _cache[endpoint];
  try {
    const r = await fetch(endpoint, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const j = await r.json();
      _cache[endpoint] = j.items || mockData;
      return _cache[endpoint];
    }
  } catch { /* Backend nicht erreichbar → Mock */ }
  return mockData;
}

const MOCK_HOSTS        = ['web-prod-01','web-prod-02','db-master','db-replica','app-server-01','app-server-02','redis-01','lb-frontend','monitoring-01','backup-server','mail-relay','vpn-gateway'];
const MOCK_SERVICES     = ['HTTP Check','Ping','CPU Load','Memory','Disk Usage','SSH','HTTPS Certificate','Database Connection','NTP','SNMP'];
const MOCK_HOSTGROUPS   = ['Linux Servers','Windows Servers','Network Devices','Storage Systems','Virtualization Hosts','DMZ Hosts'];
const MOCK_SERVICEGROUPS= ['HTTP Services','Database Services','Monitoring Services','Backup Services','Security Services'];
const MOCK_BI           = ['my_bi_collection','infrastructure','frontend_stack','database_cluster','payment_platform'];

function _endpointFor(type) {
  const map = { host: '/cmk/hosts', service: '/cmk/services',
                hostgroup: '/cmk/hostgroups', servicegroup: '/cmk/servicegroups', bi: '/cmk/bi-packs' };
  return map[type] || null;
}
function _mockFor(type) {
  const map = { host: MOCK_HOSTS, service: MOCK_SERVICES,
                hostgroup: MOCK_HOSTGROUPS, servicegroup: MOCK_SERVICEGROUPS, bi: MOCK_BI };
  return map[type] || [];
}

export function updateUndoRedoButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = history.past.length   === 0;
  if (r) r.disabled = history.future.length === 0;
}

export async function updateInspector() {
  // ── Multi-Select ───────────────────────────────────────────────────────
  if (multiSelect.size > 0) {
    inspector.classList.remove('hidden');
    noSelection.classList.add('hidden');
    const alignBtns = multiSelect.size >= 2 ? `
      <div class="mt-4">
        <label class="block text-gray-400 mb-1">Ausrichten</label>
        <div class="grid grid-cols-3 gap-1">
          <button data-align="left"         class="align-btn bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">⬅ L</button>
          <button data-align="center-h"     class="align-btn bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">⬌ H</button>
          <button data-align="right"        class="align-btn bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">R ➡</button>
          <button data-align="top"          class="align-btn bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">⬆ O</button>
          <button data-align="middle-v"     class="align-btn bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">⬍ V</button>
          <button data-align="bottom"       class="align-btn bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">U ⬇</button>
          <button data-align="distribute-h" class="align-btn col-span-3 bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">⬌⬌ Verteilen H</button>
          <button data-align="distribute-v" class="align-btn col-span-3 bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 hover:bg-[#333] text-xs">⬍⬍ Verteilen V</button>
        </div>
      </div>` : '';
    inspector.innerHTML = `
      <div class="space-y-4 text-sm">
        <div class="text-white font-semibold">${multiSelect.size} Nodes ausgewählt</div>
        ${alignBtns}
        <div class="pt-2">
          <button id="btn-del-multi" class="w-full bg-red-700 hover:bg-red-600 text-white font-medium py-2 px-4 rounded transition">Alle löschen</button>
        </div>
      </div>`;
    document.getElementById('btn-del-multi')?.addEventListener('click', deleteSelected);
    document.querySelectorAll('.align-btn').forEach(btn =>
      btn.addEventListener('click', () => alignNodes(btn.dataset.align))
    );
    return;
  }

  if (!state.selectedNode && !state.selectedEdge) {
    inspector.classList.add('hidden');
    noSelection.classList.remove('hidden');
    return;
  }

  inspector.classList.remove('hidden');
  noSelection.classList.add('hidden');

  // ── Edge-Inspector ────────────────────────────────────────────────────
  if (state.selectedEdge) {
    const edge = state.selectedEdge;
    const fn = graphState.nodes.find(n => n.id === edge.from);
    const tn = graphState.nodes.find(n => n.id === edge.to);
    const cur = edge.routing || 'straight';
    inspector.innerHTML = `
      <div class="space-y-4 text-sm">
        <div><label class="block text-gray-400 mb-1">Verbindung</label>
          <div class="text-white">${fn?.label ?? edge.from} → ${tn?.label ?? edge.to}</div>
          ${edge.fromPort ? `<div class="text-xs text-gray-500 mt-0.5">Port: ${edge.fromPort} → ${edge.toPort ?? '?'}</div>` : ''}
        </div>
        <div>
          <label class="block text-gray-400 mb-1">Linientyp</label>
          <div class="flex gap-1">
            <button data-r="straight" class="routing-btn flex-1 py-1 rounded text-xs font-medium border transition
              ${cur==='straight' ? 'bg-[#13d38e] text-black border-[#13d38e]' : 'bg-[#1e1e1e] border-[#444] text-gray-300 hover:bg-[#333]'}">
              Gerade
            </button>
            <button data-r="bezier" class="routing-btn flex-1 py-1 rounded text-xs font-medium border transition
              ${cur==='bezier' ? 'bg-[#13d38e] text-black border-[#13d38e]' : 'bg-[#1e1e1e] border-[#444] text-gray-300 hover:bg-[#333]'}">
              Bézier
            </button>
          </div>
        </div>
        <div>
          <label class="block text-gray-400 mb-1">Pfeil</label>
          <div class="flex gap-1">
            ${[
              { v: 'none',    icon: '—',  title: 'Kein Pfeil'   },
              { v: 'chevron', icon: '▶',  title: 'Chevron'      },
              { v: 'thin',    icon: '›',  title: 'Offen (dünn)' },
              { v: 'dot',     icon: '●',  title: 'Punkt'        },
            ].map(o => {
              const a = edge.arrowStyle ?? 'none';
              const act = a === o.v;
              return `<button data-arrow="${o.v}" title="${o.title}"
                class="arrow-btn flex-1 py-1 rounded text-sm font-medium border transition
                  ${act ? 'bg-[#13d38e] text-black border-[#13d38e]' : 'bg-[#1e1e1e] border-[#444] text-gray-300 hover:bg-[#333]'}">
                ${o.icon}
              </button>`;
            }).join('')}
          </div>
        </div>
        ${(edge.arrowStyle ?? 'none') !== 'none' ? `
        <div>
          <label class="block text-gray-400 mb-1">Pfeilgröße</label>
          <div class="flex gap-1">
            ${[
              { v: 'sm', label: 'Kl' },
              { v: 'md', label: 'Mi' },
              { v: 'lg', label: 'Gr' },
            ].map(o => {
              const act = (edge.arrowSize ?? 'sm') === o.v;
              return `<button data-size="${o.v}"
                class="size-btn flex-1 py-1 rounded text-xs font-medium border transition
                  ${act ? 'bg-[#13d38e] text-black border-[#13d38e]' : 'bg-[#1e1e1e] border-[#444] text-gray-300 hover:bg-[#333]'}">
                ${o.label}
              </button>`;
            }).join('')}
          </div>
        </div>` : ''}
        <div class="text-xs text-gray-500">Waypoints: ${(edge.waypoints || []).length}
          <span class="ml-1 text-gray-600">(Handles auf Kante ziehen)</span>
        </div>
        <div class="pt-2">
          <button id="btn-del-edge" class="w-full bg-red-700 hover:bg-red-600 text-white font-medium py-2 px-4 rounded transition">Verbindung löschen</button>
        </div>
      </div>`;
    document.getElementById('btn-del-edge')?.addEventListener('click', deleteSelected);
    document.querySelectorAll('.routing-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        edge.routing = btn.dataset.r;
        scheduleRedrawEdges();
        updateInspector();
      })
    );
    document.querySelectorAll('.arrow-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        edge.arrowStyle = btn.dataset.arrow;
        scheduleRedrawEdges();
        updateInspector();
      })
    );
    document.querySelectorAll('.size-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        edge.arrowSize = btn.dataset.size;
        scheduleRedrawEdges();
        updateInspector();
      })
    );
    return;
  }

  // ── Node-Inspector ────────────────────────────────────────────────────
  const node = state.selectedNode;

  let aggSection = '';
  if (node.type === 'aggregator') {
    const cur    = node.aggType || 'and';
    const params = (node.params || []).join(', ');
    aggSection = `
      <div>
        <label class="block text-gray-400 mb-1">Aggregation-Typ</label>
        <select id="agg-type-select" class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e]">
          ${aggregatorTypes.map(o => `<option value="${o.value}" ${o.value===cur?'selected':''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-gray-400 mb-1">Parameter
          <span class="text-gray-600 font-normal ml-1">(z.B. HOSTNAME, FS)</span>
        </label>
        <input type="text" id="inp-params" value="${params}"
               placeholder="HOSTNAME, SERVICE"
               class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e] text-white font-mono text-xs">
        <div class="text-xs text-gray-600 mt-0.5">Im Label/Feld als <code class="text-[#13d38e]">$NAME$</code> nutzen</div>
      </div>`;
  }

  const HOST_LIKE   = ['host', 'hostgroup'];
  const SVC_LIKE    = ['service', 'servicegroup'];
  const showHostSvc = HOST_LIKE.includes(node.type) || SVC_LIKE.includes(node.type);
  const hostSvcLabel = { host: 'Host', hostgroup: 'Host-Gruppe', service: 'Service', servicegroup: 'Service-Gruppe' }[node.type] ?? '';
  const hostSvcPlaceholder = { host: 'z.B. web-prod-01', hostgroup: 'z.B. Linux Servers', service: 'z.B. HTTP Check', servicegroup: 'z.B. HTTP Services' }[node.type] ?? '';

  const REGEX_HOST = node.type === 'hostregex';
  const REGEX_SVC  = node.type === 'serviceregex';
  const regexSection = (REGEX_HOST || REGEX_SVC) ? `
    <div>
      <label class="block text-gray-400 mb-1">Host-Regex <span class="text-gray-600 font-normal text-xs">z.B. web-prod-.*</span></label>
      <input type="text" id="inp-host-regex" value="${node.meta?.hostRegex || ''}" placeholder="web-prod-.*"
             class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e] text-white font-mono text-xs">
    </div>
    ${REGEX_SVC ? `
    <div>
      <label class="block text-gray-400 mb-1">Service-Regex <span class="text-gray-600 font-normal text-xs">z.B. HTTP.*</span></label>
      <input type="text" id="inp-svc-regex" value="${node.meta?.serviceRegex || ''}" placeholder="HTTP.*"
             class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e] text-white font-mono text-xs">
    </div>` : ''}
  ` : '';

  // Vorschläge aus API laden (async, nicht-blockierend)
  let hostSvcSuggestions = [];
  if (showHostSvc) {
    const ep = _endpointFor(node.type);
    hostSvcSuggestions = await _fetchSuggestions(ep, _mockFor(node.type));
  }
  let biSuggestions = [];
  if (node.type === 'bi') {
    biSuggestions = await _fetchSuggestions('/cmk/bi-packs', MOCK_BI);
  }

  const hostSvcSection = showHostSvc ? `
    <div>
      <label class="block text-gray-400 mb-1">${hostSvcLabel}</label>
      <input type="text" id="inp-host-svc" list="host-svc-datalist"
             value="${node.meta?.hostSvc || ''}" placeholder="${hostSvcPlaceholder}"
             class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e] text-white">
      <datalist id="host-svc-datalist">
        ${hostSvcSuggestions.map(h => `<option value="${h}">`).join('')}
      </datalist>
    </div>` : '';

  const biSection = node.type === 'bi' ? `
    <div>
      <label class="block text-gray-400 mb-1">Verweis auf BI</label>
      <input type="text" id="inp-bi-ref" list="bi-ref-datalist"
             value="${node.meta?.biRef || ''}" placeholder="z.B. infrastructure"
             class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e] text-white">
      <datalist id="bi-ref-datalist">
        ${biSuggestions.map(b => `<option value="${b}">`).join('')}
      </datalist>
    </div>` : '';

  const layerOptions = graphState.layers.length ? `
    <option value="">— kein Layer —</option>
    ${graphState.layers.map(l => `<option value="${l.id}" ${node.layerId===l.id?'selected':''}>${l.name}</option>`).join('')}
  ` : '<option value="">— keine Layer vorhanden —</option>';

  inspector.innerHTML = `
    <div class="space-y-4 text-sm">
      <div>
        <label class="block text-gray-400 mb-1">Label</label>
        <input type="text" id="inp-label" value="${node.label || ''}"
               class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e]">
      </div>
      <div>
        <label class="block text-gray-400 mb-1">Farbe</label>
        <div class="flex items-center gap-2">
          <input type="color" id="inp-color" value="${node.color}"
                 class="w-10 h-8 rounded cursor-pointer border border-[#444] bg-transparent">
          <span id="color-hex" class="text-xs text-gray-400">${node.color}</span>
        </div>
      </div>
      ${hostSvcSection}
      ${biSection}
      ${regexSection}
      <div><label class="block text-gray-400 mb-1">Typ</label><div class="text-white">${node.type}</div></div>
      ${aggSection}
      <div>
        <label class="block text-gray-400 mb-1">Layer</label>
        <select id="inp-layer" class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e]">
          ${layerOptions}
        </select>
      </div>
      <div class="pt-2">
        <button id="btn-connect" class="w-full bg-[#13d38e] hover:bg-[#0fa678] text-black font-medium py-2 px-4 rounded transition">
          Mit anderem Knoten verbinden →
        </button>
      </div>
      <div class="pt-1">
        <button id="btn-del-node" class="w-full bg-red-700 hover:bg-red-600 text-white font-medium py-2 px-4 rounded transition">
          Node löschen
        </button>
      </div>
      <div class="text-xs text-gray-500 mt-3">ID: #${node.id}</div>
    </div>`;

  document.getElementById('inp-label')?.addEventListener('input', e => {
    node.label = e.target.value.trim() || node.type;
    const lbl = document.querySelector(`[data-id="${node.id}"] .node-label`);
    if (lbl) lbl.textContent = node.label;
  });

  document.getElementById('inp-color')?.addEventListener('input', e => {
    node.color = e.target.value;
    document.getElementById('color-hex').textContent = node.color;
    const nodeEl = document.querySelector(`[data-id="${node.id}"]`);
    if (nodeEl) {
      nodeEl.style.borderColor     = node.color;
      nodeEl.style.backgroundColor = `${node.color}15`;
    }
    scheduleRedrawEdges();
  });

  document.getElementById('inp-host-svc')?.addEventListener('input', e => {
    if (!node.meta) node.meta = {};
    node.meta.hostSvc = e.target.value;
  });

  document.getElementById('inp-host-regex')?.addEventListener('input', e => {
    if (!node.meta) node.meta = {};
    node.meta.hostRegex = e.target.value;
    _updateRegexOnNode(node);
  });

  document.getElementById('inp-svc-regex')?.addEventListener('input', e => {
    if (!node.meta) node.meta = {};
    node.meta.serviceRegex = e.target.value;
    _updateRegexOnNode(node);
  });

  document.getElementById('inp-bi-ref')?.addEventListener('input', e => {
    if (!node.meta) node.meta = {};
    node.meta.biRef = e.target.value;
    const nodeEl = document.querySelector(`[data-id="${node.id}"]`);
    if (nodeEl) {
      let refEl = nodeEl.querySelector('.node-biref');
      if (e.target.value) {
        if (!refEl) {
          refEl = document.createElement('div');
          refEl.className = 'text-xs opacity-70 mt-0.5 node-biref';
          nodeEl.appendChild(refEl);
        }
        refEl.textContent = '↗ ' + e.target.value;
      } else if (refEl) {
        refEl.remove();
      }
    }
  });

  document.getElementById('inp-params')?.addEventListener('input', e => {
    node.params = e.target.value
      .split(',')
      .map(s => s.trim().replace(/\$/g, '').toUpperCase())
      .filter(Boolean);
    _updateParamsOnNode(node);
  });

  document.getElementById('agg-type-select')?.addEventListener('change', e => {
    node.aggType = e.target.value;
    const nodeEl = document.querySelector(`[data-id="${node.id}"]`);
    if (nodeEl) {
      let tl = nodeEl.querySelector('.node-aggtype');
      if (tl) { tl.textContent = `(${e.target.value.toUpperCase()})`; }
      else {
        tl = document.createElement('div');
        tl.className   = 'text-xs opacity-80 mt-0.5 node-aggtype';
        tl.textContent = `(${e.target.value.toUpperCase()})`;
        nodeEl.appendChild(tl);
      }
    }
  });

  document.getElementById('inp-layer')?.addEventListener('change', e => {
    node.layerId = e.target.value || undefined;
    import('../ui/layers-ui.js').then(m => m.renderLayers());
  });

  document.getElementById('btn-connect')?.addEventListener('click', () => {
    if (state.selectedNode) enterConnectMode(state.selectedNode.id);
  });
  document.getElementById('btn-del-node')?.addEventListener('click', deleteSelected);
}

// ── Regex-Badge auf Node aktualisieren ───────────────────────────────────
function _updateRegexOnNode(node) {
  const nodeEl = document.querySelector(`[data-id="${node.id}"]`);
  if (!nodeEl) return;
  let el = nodeEl.querySelector('.node-regex');
  const text = node.meta?.hostRegex
    ? node.meta.hostRegex + (node.meta?.serviceRegex ? ' / ' + node.meta.serviceRegex : '')
    : null;
  if (text) {
    if (!el) {
      el = document.createElement('div');
      el.className = 'text-xs opacity-60 mt-0.5 node-regex font-mono';
      nodeEl.appendChild(el);
    }
    el.textContent = text;
  } else if (el) {
    el.remove();
  }
}

// ── Parameter-Badge auf Node aktualisieren ────────────────────────────────
function _updateParamsOnNode(node) {
  const nodeEl = document.querySelector(`[data-id="${node.id}"]`);
  if (!nodeEl) return;
  let el = nodeEl.querySelector('.node-params');
  if (node.params?.length) {
    if (!el) {
      el = document.createElement('div');
      el.className = 'text-xs opacity-60 mt-0.5 node-params font-mono';
      nodeEl.appendChild(el);
    }
    el.textContent = '(' + node.params.map(p => `$${p}$`).join(', ') + ')';
  } else if (el) {
    el.remove();
  }
}
