

### Gesamtziel (MVP)
Ein **produktiv nutzbarer** Visio-ähnlicher BI-Editor, mit dem man echte Check_MK-BI-Regeln grafisch erstellen, bearbeiten, validieren und per Dry-Run anwenden kann – bis ca. **Ende April / Mitte Mai 2026**.

### Phasenplan (realistisch, mit geschätztem Aufwand bei 2–4 h/Tag)

| Phase | Dauer | Ziel | Wichtigste Tasks | Priorität | Warum jetzt? |
|-------|-------|------|------------------|-----------|--------------|
| **1: Interaktions-Polish** | 3–5 Tage | Echte Visio-UX bei Node-Edge-Interaktion | • Ports (4-seitig, Drag-from-Port)<br>• Vollständiger dynamischer Inspector<br>• Layers-UI (Toolbar + Zuweisung)<br>• Connect-Mode verbessern + visuelles Feedback | ★★★★★ | Du hast gerade Auto-Route & Layers gebaut → jetzt muss die grundlegende Interaktion „fertig“ sein, sonst fühlt sich alles noch „halb“ an. |
| **2: CMK-Integration & Preview** | 5–7 Tage | Der Editor wird zur echten BI-Werkzeug | • Backend-Anbindung (FastAPI → echte Endpoints)<br>• Preview/Dry-Run Button (mit Zustands-Highlighting)<br>• Unresolved Objects Modal<br>• Import/Export echte BI-Regeln (UI-JSON ↔ CMK) | ★★★★★ | Das ist der größte Mehrwert gegenüber einem reinen Zeichentool. Ohne das bleibt es nur „schön“. |
| **3: Advanced Editor Features** | 4–6 Tage | Macht den Editor wirklich stark | • Orthogonales Routing mit Avoidance (dein Auto-Route weiter ausbauen)<br>• Node-Typen + State-Farben (Host/Service/Aggregator + OK/WARN/CRIT)<br>• Validierung (lokale + Backend)<br>• Align/Distribute + Smart-Guides | ★★★★ | Baut direkt auf Phase 1 auf und nutzt die schon vorhandene Engine. |
| **4: Polish & Production-Ready** | 3–5 Tage | Fertig für den Alltag / Plugin | • Keyboard-Shortcuts + Accessibility<br>• Performance bei 200+ Nodes<br>• Export als Check_MK-Plugin (optional)<br>• Audit-Log, Versionierung, Error-Handling | ★★★ | Nice-to-have, aber erst wenn die Kernfunktionen stehen. |

### Meine konkrete Empfehlung: Was du **jetzt** als Nächstes machen solltest

**Nächste 3–5 Tage = Phase 1 starten (mein Top-Tipp)**

1. **Ports einführen** (höchster UX-Gewinn)  
   → 4 kleine Kreise an den Node-Seiten  
   → Drag nur von Port → Port (nicht mehr Node-to-Node)  
   → Visuelles Feedback beim Hover/Drag

2. **Inspector richtig ausbauen** (zweithöchster Gewinn)  
   → Dynamisch je nach Node/Edge-Typ  
   → Selector-Feld mit Autocomplete-Vorschlägen (erstmal Mock)  
   → Aggregation-Methode, States, Farben, Label etc.

3. **Layers-UI** (da du gerade Layers gebaut hast)  
   → Kleine Toolbar oben mit Layer-Liste  
   → Node kann Layer zugewiesen bekommen  
   → Layer togglen (sichtbar/unsichtbar) oder Lock

---

Refactoring main.js
```
/js/
├── core/
│   ├── state.js              ← graphState, history, selection, layers
│   ├── actions.js            ← alle reinen State-Mutationen (addNode, moveNodes, addEdge, undo, redo…)
│   ├── constants.js          ← NODE_WIDTH, COLORS, SNAP_DISTANCE, etc.
│
├── renderer/
│   ├── node-renderer.js
│   ├── edge-renderer.js
│   ├── grid-renderer.js
│   ├── renderer.js           ← zentrale render()-Funktion + pooling
│
├── interactions/
│   ├── mouse-handler.js      ← Haupt-Mouse-Event-Delegation
│   ├── drag-handler.js
│   ├── connect-handler.js
│   ├── marquee-handler.js
│   ├── keyboard-handler.js
│
├── ui/
│   ├── inspector.js
│   ├── toolbar.js
│   ├── context-menu.js
│   ├── layers-ui.js
│
├── utils/
│   ├── svg-utils.js
│   ├── geometry.js           ← snap, align, distance, bezier etc.
│   ├── history-utils.js
│
├── app.js                    ← Haupt-Initialisierung + Event-Setup
```

---

Restructure

```
ui-4-bi/
├── 3/                          
│   ├── index.html
│   ├── main.py
│   ├── draft.md
│   ├── logo.svg
│   └── js/                     ← ← NEU: alles JavaScript kommt hier rein
│       ├── app.js              ← Haupt-Einstiegspunkt (Initialisierung)
│       │
│       ├── core/
│       │   ├── constants.js
│       │   ├── state.js
│       │   └── actions.js
│       │
│       ├── renderer/
│       │   ├── renderer.js
│       │   ├── node-renderer.js
│       │   ├── edge-renderer.js
│       │   └── grid-renderer.js
│       │
│       ├── interactions/
│       │   ├── mouse-handler.js
│       │   ├── drag-handler.js
│       │   ├── connect-handler.js
│       │   ├── marquee-handler.js
│       │   ├── keyboard-handler.js
│       │   └── port-handler.js          ← später für Ports
│       │
│       ├── ui/
│       │   ├── toolbar.js
│       │   ├── inspector.js
│       │   ├── context-menu.js
│       │   └── layers-ui.js
│       │
│       ├── utils/
│       │   ├── svg-utils.js
│       │   ├── geometry.js
│       │   └── dom-utils.js
│       │
│       └── types.js                    ← (optional) Type-Definitionen als JSDoc
│
├── mockup/
└── ... (andere Ordner)
```
