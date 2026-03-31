import { graphState, state, multiSelect, history, inspector, noSelection } from '../core/state.js';
import { aggregatorTypes } from '../core/constants.js';
import { deleteSelected, alignNodes, enterConnectMode } from '../core/actions.js';

export function updateUndoRedoButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = history.past.length   === 0;
  if (r) r.disabled = history.future.length === 0;
}

export function updateInspector() {
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
    const fn = graphState.nodes.find(n => n.id === state.selectedEdge.from);
    const tn = graphState.nodes.find(n => n.id === state.selectedEdge.to);
    inspector.innerHTML = `
      <div class="space-y-4 text-sm">
        <div><label class="block text-gray-400 mb-1">Verbindung</label>
          <div class="text-white">${fn?.label ?? state.selectedEdge.from} → ${tn?.label ?? state.selectedEdge.to}</div>
        </div>
        <div class="text-xs text-gray-500">Waypoints: ${(state.selectedEdge.waypoints || []).length}
          <span class="ml-1 text-gray-600">(Handles auf Kante ziehen)</span>
        </div>
        <div class="pt-2">
          <button id="btn-del-edge" class="w-full bg-red-700 hover:bg-red-600 text-white font-medium py-2 px-4 rounded transition">Verbindung löschen</button>
        </div>
      </div>`;
    document.getElementById('btn-del-edge')?.addEventListener('click', deleteSelected);
    return;
  }

  // ── Node-Inspector ────────────────────────────────────────────────────
  const node = state.selectedNode;
  let aggSection = '';
  if (node.type === 'aggregator') {
    const cur = node.aggType || 'and';
    aggSection = `
      <div class="mt-4">
        <label class="block text-gray-400 mb-1">Aggregation-Typ</label>
        <select id="agg-type-select" class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e]">
          ${aggregatorTypes.map(o => `<option value="${o.value}" ${o.value===cur?'selected':''}>${o.label}</option>`).join('')}
        </select>
      </div>`;
  }

  inspector.innerHTML = `
    <div class="space-y-4 text-sm">
      <div>
        <label class="block text-gray-400 mb-1">Label</label>
        <input type="text" id="inp-label" value="${node.label || ''}"
               class="w-full bg-[#1e1e1e] border border-[#444444] rounded px-3 py-2 focus:outline-none focus:border-[#13d38e]">
      </div>
      <div><label class="block text-gray-400 mb-1">Typ</label><div class="text-white">${node.type}</div></div>
      ${aggSection}
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

  document.getElementById('btn-connect')?.addEventListener('click', () => {
    if (state.selectedNode) enterConnectMode(state.selectedNode.id);
  });
  document.getElementById('btn-del-node')?.addEventListener('click', deleteSelected);
}
