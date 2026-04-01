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

### Audit-Log
- Jede State-Mutation wird geloggt (Zeitstempel, User, Aktion, Details)
- localStorage-Persistenz (100 Einträge)
- Audit-Modal: Suche, Filter nach Aktion, CSV-Export

### Authentifizierung & Benutzerverwaltung
- **Lokale Benutzer** — PBKDF2-HMAC-SHA256, data/users.json
- **LDAP / Active Directory** — ldap3, Bind-DN, Gruppen-Mapping
- **Checkmk-Auth** — REST-API Basic Auth, Rollen-Ermittlung
- **Auth-Kette:** lokal → LDAP → Checkmk (erste Übereinstimmung gewinnt)
- **JWT-Token** — HS256, 8h Laufzeit, Secret in data/.jwt_secret
- **`AUTH_ENABLED=false`** — kein Login nötig (Standard für Entwicklung)
- **Login-Modal** — Methoden-Selector (lokal/LDAP/CMK), Session-Ablauf-Handling
- **Admin-UI** — Benutzer anlegen, bearbeiten, aktivieren/deaktivieren, löschen
- **Letzter-Admin-Schutz** — letzter aktiver Admin kann nicht gelöscht werden
- **apiFetch-Wrapper** — hängt Bearer-Token an alle API-Requests, 401 → Login-Modal

### Preview
- Mock-Vorschau: simulierte Check_MK-States pro Node (OK / WARNING / CRITICAL / UNKNOWN)
- Echter Backend-Aufruf wenn `/bi/preview` verfügbar

---

## Roadmap

### Offen – Auth & Admin
- [ ] LDAP mit echtem AD testen
- [ ] Checkmk-Auth live testen
- [ ] Passwort-Änderung im UI (eigenes Passwort, `/me/password`)
- [ ] Session-Ablauf-Handling ohne Seitenneustart

### Offen – CMK-Integration
- [ ] Rule Packs (Name, Contact-Group, `pack_id`)
- [ ] Dynamischer Suchregel-Node (Host/Service per Regex)
- [ ] Preview-Modal mit echten CMK-States (Livestatus / REST-API)
- [ ] Unresolved-Objects-Modal nach Validierung

### Offen – Advanced Features
- [ ] Orthogonales Routing mit vollständiger Avoidance
- [ ] Node-State-Farben live (OK=grün, WARN=gelb, CRIT=rot)
- [ ] Smart-Guides (Abstand-Anzeige beim Verschieben)
- [ ] Keyboard-Shortcut-Übersicht (? Modal)
- [ ] Versionierung / Graph-History
