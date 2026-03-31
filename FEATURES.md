# Feature-Übersicht – CMK BI Visual Editor

## Implementiert

### Canvas & Navigation
- Endlos-Canvas mit Zoom (Scroll-Wheel zur Mausposition) und Pan (Space+Drag / Mittelklick)
- Grid-Hintergrund (20px-Raster)
- Grid-Snap (Ein/Aus per Toolbar-Button)
- Snaplines beim Verschieben (grün = X, rot = Y)

### Nodes
- 3 Node-Typen: **BI Aggregator**, **Host (Process)**, **Service**
- Drag & Drop aus der Palette auf den Canvas
- Verschieben per Drag (einzeln oder Multi-Select)
- Inline-Edit: Doppelklick → Label direkt bearbeiten
- Duplizieren per Kontextmenü
- Löschen (Kontextmenü, Entf-Taste, Inspector-Button)
- Aggregation-Typ pro Aggregator-Node (AND / OR / Best / Worst / Best of N / Worst of N)

### Kanten (Edges)
- Verbindung durch Klick auf „Verbinden" im Inspector oder per Kontextmenü
- **Zwei Routing-Modi** (umschaltbar per Rechtsklick):
  - Gerade Linie (Standard, mit L-Waypoints)
  - Bézier-Kurve (mit automatischer Kollisionserkennung)
- Waypoints: Handles auf Kante ziehen → neuen Knickpunkt hinzufügen
- Waypoint-Doppelklick → entfernen
- Richtung umkehren per Kontextmenü
- Parallele Kanten: automatischer Versatz (≥ 2px)

### Auswahl & Multi-Select
- Einfachklick → Einzelauswahl
- Shift+Klick → zur Auswahl hinzufügen / entfernen
- Marquee-Selection: Lasso über freie Fläche ziehen
- ESC → Auswahl aufheben

### Align & Distribute
- Links, Mitte H, Rechts ausrichten
- Oben, Mitte V, Unten ausrichten
- Gleichmäßig verteilen (H / V)
- Nur bei Multi-Select aktiv (Inspector-Panel)

### Auto-Layout
- **Top → Bottom** (TD) — Sugiyama-inspiriertes Hierarchie-Layout
- **Left → Right** (LR)
- **Am Raster ausrichten** (GRID) — snapped alle Nodes auf 20px-Raster
- Kreuzungsminimierung (Barycenter-Heuristik, 2 Durchläufe)
- Orthogonale Edge-Routing mit Gutter-Waypoints nach Layout
- Skip-Layer-Bypass (Kanten überspringen Zwischenlayer ohne Kollision)
- Hauptbutton togglet TD ↔ LR; Dropdown für alle Modi
- Animierte Übergänge (350ms)

### Undo / Redo
- Unbegrenzt (bis 100 Schritte) — Ctrl+Z / Ctrl+Y
- Alle State-Mutationen (Move, Add, Delete, Edit, Layout) erfasst

### Kontextmenü
- **Rechtsklick auf Node**: Label bearbeiten, Verbinden, Aggregation-Typ, Duplizieren, Löschen
- **Rechtsklick auf Kante**: Gebogen/Gerade, Waypoints zurücksetzen, Richtung umkehren, Löschen

### Speichern & Import/Export
- **Speichern** → POST `/save` (FastAPI-Backend), Fallback auf localStorage
- **Validieren** → POST `/validate`
- **JSON Export** → Download `bi_graph.json`
- **JSON Import** → Datei-Upload, vollständiger Graph-Ersatz

### Performance (500–2k Nodes)
- RAF-Throttling: Edge-Redraws gebündelt per `requestAnimationFrame`
- Viewport-Culling: Nodes außerhalb des Sichtfelds werden ausgeblendet
- DOM-Pooling: `<div>`-Elemente werden wiederverwendet
- Persistenter Edge-SVG: wird gecleared statt neu erstellt

### Audit-Log & RBAC
- Jede State-Mutation wird geloggt (Zeitstempel, User, Aktion, Details)
- localStorage-Persistenz (100 Einträge)
- Audit-Modal: Suche, Filter nach Aktion, CSV-Export
- Benutzername: localStorage, änderbar per Popover

### Preview
- Mock-Vorschau: simulierte Check_MK-States pro Node (OK / WARNING / CRITICAL / UNKNOWN)
- Echter Backend-Aufruf wenn `/bi/preview` verfügbar

---

## Roadmap

### Phase 1 – Interaktions-Polish (nächste Schritte)
- [ ] Ports (4 seitige Port-Punkte an Node-Kanten, Drag von Port zu Port)
- [ ] Vollständiger dynamischer Inspector (Selector-Felder mit Autocomplete)
- [ ] Layers-UI (Layer-Liste, Sichtbarkeit, Lock)
- [ ] Connect-Modus: visuelles Feedback verbessern

### Phase 2 – CMK-Integration
- [ ] Backend-Anbindung an echte Check_MK-Endpoints
- [ ] Echter Preview / Dry-Run mit Zustands-Highlighting auf Canvas
- [ ] Import / Export echter BI-Regelformat (UI-JSON ↔ CMK-YAML/JSON)
- [ ] Unresolved-Objects-Modal

### Phase 3 – Advanced Features
- [ ] Orthogonales Routing mit vollständiger Avoidance
- [ ] Node-State-Farben live (OK=grün, WARN=gelb, CRIT=rot)
- [ ] Lokale + Backend-Validierung mit Fehler-Highlighting
- [ ] Smart-Guides (Abstand-Anzeige beim Verschieben)

### Phase 4 – Production-Ready
- [ ] Keyboard-Shortcut-Übersicht (? Modal)
- [ ] Performance-Test bei 500+ Nodes
- [ ] Check_MK-Plugin Export
- [ ] Versionierung / Graph-History
