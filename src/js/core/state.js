// ── Graph-Daten ───────────────────────────────────────────────────────────
export const graphState = { nodes: [], edges: [], nextId: 1 };
export const history    = { past: [], future: [] };
export const multiSelect = new Set();   // stores node IDs
export const auditLog    = [];

// ── Mutable UI-State (als Objekt, damit alle Module dieselbe Referenz teilen)
export const state = {
  selectedNode:   null,
  selectedEdge:   null,
  connectingFrom: null,
  zoomLevel:      1,
  panX:           0,
  panY:           0,
  isPanning:      false,
  panStartX:      0,
  panStartY:      0,
  snap:           true,
  layoutDir:      'TB',
  currentUser:    localStorage.getItem('bi_user') || 'anonymous',
  draggingWP:     null,
  spacePressed:   false,
  marqueeActive:  false,
  marqueeStart:   { x: 0, y: 0 },
};

// ── DOM-Referenzen (sicher, da Modul nach DOM-Aufbau geladen wird) ─────────
export const canvas        = document.getElementById('canvas');
export const canvasWrapper = document.getElementById('canvas-wrapper');
export const inspector     = document.getElementById('inspector');
export const noSelection   = document.getElementById('no-selection');
export const zoomDisplay   = document.getElementById('zoom-level');
export const marqueeEl     = document.getElementById('marquee');
export const snaplineLayer = document.getElementById('snapline-layer');
