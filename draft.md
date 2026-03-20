Draft-Entwurf-Konzept_VanillaJS_VisioStyle.md
Datum: March 19, 2026

Ziel
- Eigenständige Web‑UI (Vanilla JS + SVG), Bedienung wie in Visio/Flowchart-Editor, zur Visualisierung und Editierung von Check_MK BI Business‑Processes.
- UI liest/schreibt Check_MK BI‑Regeln (CMK bleibt Quelle der Wahrheit), persistiert UI‑Metadaten separat, bietet Preview/Dry‑Run und Undo/Redo.

Annahmen
- Backend‑Adapter (FastAPI oder CMK‑Plugin) stellt REST‑Endpoints für BI‑Regeln, Objektsuche und Preview bereit.
- Frontend: reines Vanilla JS, SVG‑Canvas, keinerlei externe Graph‑Library.
- Speicherung: CMK hält canonical rules; UI speichert layout/ui_meta in separaten JSON‑Files (POC: localStorage/mocked backend).

Kurzarchitektur
- Frontend (Vanilla JS)
  - index.html: Toolbar, SVG Canvas, Sidebar/Inspector, Modals
  - main.js: AppState, Renderer, Event‑Handlers, Undo/Redo, Persistence Adapter
  - styles.css: UI Styling
- Backend
  - REST API (specified endpoints) — POC uses mocked backend; production uses adapter that converts UI JSON ↔ CMK rules via CMK APIs or rule files + reload.
- Storage
  - Canonical: Check_MK rule store
  - UI metadata: /var/lib/check_mk/bi_ui/<rule_id>.json (recommended) or CMK config store

1) Haupt‑Funktionalitäten (Visio‑like)
- Create/Place nodes, drag/drop, resize, inline label edit
- Create/connect edges by dragging from ports
- Pan/zoom canvas; grid + snap; snaplines & align guides
- Edge routing with editable waypoints (orthogonal/polyline)
- Multi‑select (Shift), marquee selection, align/distribute
- Undo/Redo, keyboard shortcuts, delete with confirmation
- Inspector for node/edge properties (selector, states, aggregation, visuals)
- Import/Export JSON, Save/Apply (dry‑run preview), Resolve unresolved objects modal

2) Datenmodell (UI JSON)
- Rule:
  - { id, title, description, active, version, nodes:[], edges:[], graph:{layout:'manual'}, ui_meta:{} }
- Node:
  - { id, label, selector, type, x, y, w, h, color, states:[], aggregation, ui_meta }
- Edge:
  - { id, sourceId, targetId, waypoints:[{x,y},...], operator, style }
- Example:
{
  "id":"bp-001",
  "title":"Payment Platform",
  "active":true,
  "version":1,
  "nodes":[{"id":"n1","label":"Payment","selector":"hostA:pay","type":"service","x":100,"y":80,"w":160,"h":60,"color":"#f7c","states":["CRITICAL"],"aggregation":"majority"}],
  "edges":[{"id":"e1","sourceId":"n1","targetId":"n2","waypoints":[{"x":260,"y":110}],"operator":"AND"}],
  "ui_meta":{"created_by":"alice","created_at":"2026-03-19T10:00:00Z"}
}

3) AppState & Binding
- state = {
  currentRule,
  selection: {nodes:Set, edges:Set},
  history: {past:[], future:[]},
  settings: {gridSize, snap, zoom},
  persistenceAdapter
}
- Renderer draws nodes/edges from state into SVG groups: grid, edges, nodes, overlay.
- Interactions update state; committed actions push to history.past; undo pops to history.future.

4) Interaction Model (Visio-like)
- Create Node: Toolbar "New Node" → click canvas to place.
- Move Node: drag header; Shift+drag duplicates (opt).
- Create Edge: drag from port → release on target port to connect.
- Inline Edit: double‑click label → input → Enter to save.
- Multi‑select: Shift+click or marquee.
- Delete: Del key / toolbar.
- Waypoint Edit: click edge to show midpoint handles; drag to reshape; double‑click to add waypoint.
- Align/Snap: toolbar actions for align/distribute; snapping to grid or snaplines while moving.
- Undo/Redo: Ctrl+Z / Ctrl+Y; grouped actions supported.

5) Renderer & Performance
- Use SVG; pool elements to reduce DOM churn.
- Use requestAnimationFrame for interactive rendering.
- For large graphs support viewport simplification and element culling.
- Edge routing: simple orthogonal elbow routing with optional user waypoints.

6) Validation & Preview
- Local validation: selector syntax heuristics; check for empty labels, disconnected required nodes.
- Resolve unresolved objects via backend GET /objects?query=…
- Preview: POST /bi/preview with UI JSON → returns predicted BI states and affected hosts/services.

7) REST Endpoints (Frontend ↔ Backend)
- GET /bi/rules
- GET /bi/rules/{id}
- POST /bi/rules
- PUT /bi/rules/{id}
- DELETE /bi/rules/{id}
- GET /objects?query=...
- POST /bi/preview
- POST /bi/import
- POST /bi/export/{id}
Notes:
- Use optimistic locking: include version in PUT; on conflict return 409 with diff.
- Backend should validate and return detailed error/warning messages.

8) Undo/Redo & History Model
- Record atomic actions: {type, payload, inverse}
- Example move_node:
  - action: {type:'move_node', id:'n1', from:{x,y}, to:{x,y}}
  - inverse for undo: move back to from
- Group multiple actions in a transaction for single undo step.

9) UI Components & DOM Structure
- Toolbar (div.toolbar)
- Canvas Wrapper (div.canvas-wrap) with <svg id="canvas">
  - <g id="grid"/>, <g id="edges"/>, <g id="nodes"/>, <g id="overlay"/>
- Sidebar Inspector (aside.inspector)
- Modals (div.modal)
- Statusbar (footer.statusbar)

10) Edge Routing & Ports
- Ports on 4 sides (top/right/bottom/left). Port coordinates computed from node x,y,w,h.
- Default route: source port → elbow → target port; waypoints stored in edge.waypoints.
- Editable midpoints: clicking edge shows handles for adding/removing.

11) File Format, Import/Export & Migration
- UI JSON is canonical for frontend; migration adapter converts to CMK BI rule format via backend.
- Import workflow:
  - Validate schema (JSON Schema)
  - Resolve selectors via backend inventory
  - Map operators/aggregations to CMK equivalents
  - On success create rule in CMK via CMK API or write rule file + reload.
- Export: fetch CMK rule, convert to UI JSON, allow download.

12) Error Handling & Conflict Resolution
- Optimistic locking with version; on conflict show diff modal with options: overwrite, merge, cancel.
- On unresolved selectors show modal with suggestions; allow interactive mapping.
- Validation errors block save; warnings allowed with confirmation.

13) Security & Auth
- Use existing CMK authentication/session for backend calls.
- Frontend must not accept unvalidated selectors; backend sanitizes before applying to CMK rule files.
- Audit log all changes server‑side (user, timestamp, diff).

14) Accessibility & Shortcuts
- Keyboard navigation for selection and actions.
- ARIA labels for toolbar and inspector controls.
- Configurable shortcuts: N (new node), E (new edge), S (save), Z/Y (undo/redo), Del (delete).

15) Testing & QA
- Unit tests for utils, history, serialisation.
- Integration tests with mocked backend for full CRUD workflows.
- E2E tests for common user flows (create node, connect, save, preview).
- Performance tests for large graphs (500–2k nodes) and memory profiling.

16) POC / Implementation Plan (Phased)
- Phase 0 (2–3 PT): Repo skeleton, mocked backend, load single rule, render graph, drag nodes, inline edit, save to localStorage.
- Phase 1 (3–5 PT): Full CRUD via real backend, create/delete edges, import/export, undo/redo.
- Phase 2 (4–6 PT): Preview integration, validation, conflict handling, align/snaplines, waypoint editing.
- Phase 3 (2–4 PT): RBAC/audit logging, packaging as CMK plugin/service, performance hardening.

17) Repo‑Skeleton (files)
- index.html
- styles.css
- main.js
- utils.js
- svg-helpers.js
- mock-backend.js (POC)
- README.md
- assets/icons/
- tests/

18) Wichtige Designentscheidungen:
- Implement as integrated CMK plugin when possible (native CMK API access, simpler auth), otherwise separate service with secured communications.
- Persist UI layout/metadata as JSON files under /var/lib/check_mk/bi_ui/ for simplicity and backup.
- Use optimistic locking and preview/dry‑run to avoid accidental production rule changes.
- Keep visual metadata out of CMK canonical data to avoid schema changes.

Anhang — Kerncode‑Snippets (konkret)
- Create SVG node (Vanilla JS):

function createNodeElement(node) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.classList.add('node');
  g.dataset.id = node.id;
  const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
  rect.setAttribute('x', node.x); rect.setAttribute('y', node.y);
  rect.setAttribute('width', node.w); rect.setAttribute('height', node.h);
  rect.setAttribute('rx', 6); rect.setAttribute('ry', 6);
  g.appendChild(rect);
  const text = document.createElementNS('http://www.w3.org/2000/svg','text');
  text.setAttribute('x', node.x + 10); text.setAttribute('y', node.y + 24);
  text.textContent = node.label;
  g.appendChild(text);
  ['top','right','bottom','left'].forEach(side => {
    const port = document.createElementNS('http://www.w3.org/2000/svg','circle');
    const p = portPosition(node, side);
    port.setAttribute('cx', p.x); port.setAttribute('cy', p.y); port.setAttribute('r',4);
    port.classList.add('port', side);
    g.appendChild(port);
  });
  return g;
}

- Drag handling (simplified):

let dragState = null;
svgCanvas.addEventListener('mousedown', (e) => {
  const nodeEl = e.target.closest('.node');
  if(nodeEl) {
    const id = nodeEl.dataset.id;
    const node = state.currentRule.nodes.find(n=>n.id===id);
    dragState = { id, startX: e.clientX, startY: e.clientY, origX: node.x, origY: node.y };
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
  }
});
function onDrag(e){
  if(!dragState) return;
  let dx = (e.clientX - dragState.startX) / state.settings.zoom;
  let dy = (e.clientY - dragState.startY) / state.settings.zoom;
  const node = getNode(dragState.id);
  node.x = state.settings.snap ? Math.round((dragState.origX + dx)/state.settings.gridSize)*state.settings.gridSize : dragState.origX + dx;
  node.y = state.settings.snap ? Math.round((dragState.origY + dy)/state.settings.gridSize)*state.settings.gridSize : dragState.origY + dy;
  renderNode(node);
}
function endDrag(){
  pushHistory({type:'move_node', id: dragState.id, from:{x:dragState.origX,y:dragState.origY}, to:{x:getNode(dragState.id).x,y:getNode(dragState.id).y}});
  dragState = null;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', endDrag);
}

Entscheidungspunkte:
- Integration: CMK plugin vs. separate service? Empfehlung: CMK plugin for native API access.
- UI metadata storage: filesystem (/var/lib/check_mk/bi_ui/) recommended.
- Routing algorithm: simple orthogonal by default; allow manual waypoints.

Nächste konkrete Schritte: 
- Erzeuge lauffähiges POC‑Skeleton (index.html, main.js, styles.css) mit mocked backend.
- Erzeuge JSON‑Schema für UI‑Rule‑Format und vollständige Mapping‑Tabelle (Thruk → CMK BI).
- Erstelle Adapter‑Skizzen zur Konvertierung UI JSON → CMK BI rule format (Python).

