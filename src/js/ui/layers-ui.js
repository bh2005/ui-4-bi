import { graphState } from '../core/state.js';
import { fullRedraw } from '../renderer/renderer.js';

// ── Layer-Liste rendern ────────────────────────────────────────────────────
export function renderLayers() {
  const listEl = document.getElementById('layers-list');
  if (!listEl) return;

  if (!graphState.layers.length) {
    listEl.innerHTML = '<div class="text-gray-600 text-xs py-1">Keine Layer vorhanden</div>';
    return;
  }

  listEl.innerHTML = graphState.layers.map(layer => `
    <div class="flex items-center gap-1 py-1 px-1 rounded hover:bg-[#2b2b2b] group layer-row"
         data-layer-id="${layer.id}">
      <button class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3a3a3a] transition"
              data-action="toggle-vis" title="${layer.visible ? 'Verstecken' : 'Anzeigen'}">
        <i data-lucide="${layer.visible ? 'eye' : 'eye-off'}"
           class="w-3 h-3 ${layer.visible ? 'text-gray-300' : 'text-gray-600'}"></i>
      </button>
      <button class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3a3a3a] transition"
              data-action="toggle-lock" title="${layer.locked ? 'Entsperren' : 'Sperren'}">
        <i data-lucide="${layer.locked ? 'lock' : 'unlock'}"
           class="w-3 h-3 ${layer.locked ? 'text-yellow-400' : 'text-gray-600'}"></i>
      </button>
      <span class="flex-1 text-xs truncate ${layer.visible ? 'text-gray-200' : 'text-gray-500 line-through'}"
            title="${layer.name}">${layer.name}</span>
      <button class="w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-red-900 transition text-red-500 text-xs font-bold"
              data-action="delete" title="Layer löschen">×</button>
    </div>
  `).join('');

  lucide.createIcons({ attrs: { 'stroke-width': 1.5 } });

  listEl.querySelectorAll('.layer-row').forEach(row => {
    const id = row.dataset.layerId;
    row.querySelector('[data-action="toggle-vis"]')?.addEventListener('click', e => {
      e.stopPropagation();
      const layer = graphState.layers.find(l => l.id === id);
      if (!layer) return;
      layer.visible = !layer.visible;
      fullRedraw();
      renderLayers();
    });
    row.querySelector('[data-action="toggle-lock"]')?.addEventListener('click', e => {
      e.stopPropagation();
      const layer = graphState.layers.find(l => l.id === id);
      if (!layer) return;
      layer.locked = !layer.locked;
      renderLayers();
    });
    row.querySelector('[data-action="delete"]')?.addEventListener('click', e => {
      e.stopPropagation();
      graphState.nodes.forEach(n => { if (n.layerId === id) delete n.layerId; });
      graphState.layers = graphState.layers.filter(l => l.id !== id);
      renderLayers();
    });
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
export function initLayersUI() {
  renderLayers();

  document.getElementById('btn-add-layer')?.addEventListener('click', () => {
    const name = prompt('Layer-Name:', `Layer ${graphState.layers.length + 1}`);
    if (!name?.trim()) return;
    graphState.layers.push({
      id:      `layer_${Date.now()}`,
      name:    name.trim(),
      visible: true,
      locked:  false,
    });
    renderLayers();
  });
}
