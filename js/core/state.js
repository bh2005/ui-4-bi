/**
 * state.js - basic graph state shape (scaffold)
 *
 * graphState:
 *  - nodes: [{ id, x, y, width, height, layerId, meta }]
 *  - edges: [{ id, sourceNode, sourcePort, targetNode, targetPort }]
 *  - selection: { nodes: [], edges: [] }
 *  - layers: [{ id, name, visible, locked }]
 */
export const graphState = {
  nodes: [],
  edges: [],
  selection: { nodes: [], edges: [] },
  layers: [],
};
