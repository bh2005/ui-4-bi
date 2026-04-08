# CMK BI Visual Editor – Feature-Übersicht
> Stand: April 2026

Browserbasierter, Visio-ähnlicher Editor zum grafischen Erstellen, Bearbeiten und Exportieren von **Checkmk BI-Regelwerken** — kein Build-Tool, kein Framework, pure ES-Module + FastAPI-Backend.

---

## ✅ Implementiert

### Canvas & Navigation
- **Endlos-Canvas** – Zoom per Scroll-Wheel zur Mausposition; Pan per Space+Drag oder Mittelklick
- **Grid-Hintergrund** – konfigurierbares Raster: 10 / 20 / 40 / 80 px; Dropdown direkt am Snap-Button; persistent in localStorage; CSS-Variable `--snap-grid-px` aktualisiert sich sofort
- **Grid-Snap** – Ein/Aus per Toolbar-Button; Node-Positionen rasten am Raster ein
- **Snaplines** – grüne (X) und rote (Y) Hilfslinien beim Verschieben

---

### Node-Typen

| Typ | Beschreibung | CMK-Äquivalent |
|---|---|---|
| **BI Aggregator** | Regelknoten; Aggregation AND / OR / Best / Worst / Best of N / Worst of N | `call_a_rule` |
| **Host (Process)** | Einzelner Nagios/CMK-Host | `state_of_host` |
| **Service** | Einzelner CMK-Service auf einem Host | `state_of_service` |
| **Host-Gruppe** | Hostgroup-Zustand | `state_of_host` (hostgroup) |
| **Service-Gruppe** | Servicegroup-Zustand | (servicegroup) |
| **Andere BI** | Referenz auf ein anderes BI-Regelwerk (`biRef`) | `call_a_rule` |
| **Host-Suchregel** | Dynamische Selektion per Regex-Pattern | `host_search` |
| **Service-Suchregel** | Dynamische Selektion per Regex-Pattern | `service_search` |

---

### Kanten (Edges)
- **Zwei Routing-Modi** – gerade Linie mit L-Waypoints oder Bézier-Kurve (umschaltbar per Rechtsklick)
- **Automatische Kollisionserkennung** – bei Bézier-Modus
- **Waypoints** – Handle auf Kante ziehen → Knickpunkt hinzufügen; Doppelklick → entfernen
- **Gerundete Ecken** – Quadratic-Bézier-Abrundung (r = 14 px) bei orthogonalen Kanten
- **Parallele Kanten** – automatischer Versatz (≥ 2 px)
- **Richtung umkehren** – per Rechtsklick-Kontextmenü
- **Pfeilstile** – Keiner (—) / Chevron (▶) / Thin (›) / Dot (●); 3 Größen (Klein / Mittel / Groß) mit skalierten SVG-Marker-viewBox
- **Ports** – 4 Port-Dots pro Node (top / right / bottom / left); `fromPort` / `toPort` in Edge gespeichert

---

### Auswahl & Multi-Select
- Einfachklick → Einzelauswahl
- Shift+Klick → zur Auswahl hinzufügen / entfernen
- **Marquee-Selection** – Lasso über freie Fläche ziehen
- ESC → Auswahl aufheben

---

### Align & Distribute
- Links / Mitte H / Rechts ausrichten
- Oben / Mitte V / Unten ausrichten
- Gleichmäßig verteilen horizontal / vertikal
- Aktiv nur bei Multi-Select (Inspector-Panel)

---

### Auto-Layout (Sugiyama)
- **Top → Bottom (TD)** und **Left → Right (LR)** – Sugiyama-inspiriertes Hierarchie-Layout
- **Raster-Ausrichten (GRID)** – snapped alle Nodes auf aktuelles Rastermaß
- **Kreuzungsminimierung** – Barycenter-Heuristik, 2 Durchläufe
- **Orthogonale Edge-Routing** – Gutter-Waypoints nach Layout; Skip-Layer-Bypass für Kanten, die Zwischenlayer überspringen
- **Animierte Übergänge** – 350 ms LERP
- Hauptbutton togglet TD ↔ LR; Dropdown für alle Modi

---

### Undo / Redo
- Bis zu **100 Schritte** – Ctrl+Z / Ctrl+Y
- Alle State-Mutationen erfasst: Move, Add, Delete, Edit, Layout, Port-Änderungen

---

### Kontextmenü
- **Rechtsklick auf Node** – Label bearbeiten, Verbinden, Aggregation-Typ, Duplizieren, Löschen
- **Rechtsklick auf Kante** – Gebogen/Gerade, Waypoints zurücksetzen, Richtung umkehren, Löschen

---

### Inspector-Panel
- Farb-Picker für Node-Farbe
- Autocomplete für Host- / Service-Namen
- Routing-Toggle (gerade ↔ Bézier)
- Layer-Zuordnung
- Aggregation-Typ-Auswahl
- Align & Distribute bei Multi-Select

---

### Layer-System
- Layer-Liste mit Toggle (ein/aus) und Lock
- Node-Zuweisung zu beliebigem Layer
- zIndex-Verwaltung

---

### Rule Packs
- Regelgruppen mit Name + Contact-Group verwalten
- Beim Export wird `pack_id` korrekt auf CMK-Format gemappt
- Rule-Pack-Auswahl im Inspector

---

### Speichern & Import/Export
- **Speichern** → POST `/save` (FastAPI-Backend); Fallback auf localStorage
- **Validieren** → POST `/validate`; Zyklen-Erkennung per Kahn's Algorithm
- **JSON Export** → Download `bi_graph.json` (internes Format)
- **JSON Import** → Datei-Upload; vollständiger Graph-Ersatz inkl. Auto-Layout
- **Export als Checkmk BI Pack JSON** – `exportToCMK()`; alle CMK-Typen: `state_of_host`, `state_of_service`, `host_search`, `service_search`, `call_a_rule`; Aggregationsfunktionen: `worst`, `best`, `count_ok`
- **Import von Checkmk BI Pack JSON** – `importFromCMK()`; Auto-Layout nach Import

---

### Preview
- **Mock-Vorschau** – simulierte CMK-States pro Node (OK / WARNING / CRITICAL / UNKNOWN)
- **Echter Backend-Aufruf** wenn `/bi/preview` verfügbar (CMK Livestatus / REST-API)

---

### Performance (500–2k Nodes)
- **RAF-Throttling** – Edge-Redraws gebündelt per `requestAnimationFrame`
- **Viewport-Culling** – Nodes außerhalb des Sichtfelds werden ausgeblendet
- **DOM-Pooling** – `<div>`-Elemente werden wiederverwendet statt neu erzeugt
- **Persistenter Edge-SVG** – wird gecleared statt neu erstellt

---

### Audit-Log
- Jede State-Mutation wird geloggt (Zeitstempel, User, Aktion, Details)
- localStorage-Persistenz (100 Einträge)
- Audit-Modal mit Suche, Filter nach Aktion, CSV-Export

---

### Authentifizierung & Benutzerverwaltung

| Feature | Details |
|---|---|
| **Lokale Benutzer** | PBKDF2-HMAC-SHA256; `data/users.json`; Default-Admin beim ersten Start |
| **LDAP / Active Directory** | ldap3; Bind-DN; Gruppen-Mapping auf Admin-Rolle |
| **Checkmk-Auth** | REST-API Basic Auth; Rollen-Ermittlung aus CMK |
| **Auth-Kette** | lokal → LDAP → Checkmk (erste Übereinstimmung gewinnt) |
| **JWT-Token** | HS256; 8h Laufzeit (konfigurierbar); Secret persistent in `data/.jwt_secret` |
| **`AUTH_ENABLED=false`** | Kein Login nötig — anonymous-Admin (Standard für Entwicklung) |
| **Login-Modal** | Methoden-Selector (lokal/LDAP/CMK); Session-Ablauf-Handling ohne Seitenneustart |
| **Session-Ablauf** | JWT-Expiry-Timer; 60s vor Ablauf → Login-Modal automatisch; abgelaufenes Token beim Start verworfen |
| **Passwort-Änderung** | Key-Button im UI; Modal; `POST /me/password` |
| **Admin-UI** | Benutzer anlegen, bearbeiten, aktivieren/deaktivieren, löschen; Letzter-Admin-Schutz |
| **apiFetch-Wrapper** | Bearer-Token an alle API-Requests; 401 → Login-Modal |

---

### Dark / Light Theme
- Toggle persistent in localStorage; Dark ist Standard
- Node-Labels im Light Mode: dunkelgrau (`#333333`) für WCAG-AA-Kontrast

---

### ES-Modul-Architektur
- **20 ES-Module** – kein Build-Tool, kein Framework; importierbar ohne Bundler
- Modulstruktur: `src/js/core/`, `src/js/interactions/`, `src/js/renderer/`, `src/js/ui/`, `src/js/utils/`

---

### Tests & CI

| Bereich | Details |
|---|---|
| **pytest Backend** | ~50 Fälle; `test_api.py`, `test_auth_manager.py`, `test_user_store.py` |
| **Vitest Frontend** | ~50 Fälle; `geometry.test.js`, `cmk-converter.test.js`, `auth.test.js` |
| **GitHub Actions CI** | `tests.yml`; Backend + Frontend als separate Jobs; läuft bei jedem Push/PR |

---

### Docker & Betrieb
- `Dockerfile` (nginx + Frontend-Static)
- `Dockerfile.backend` (FastAPI / uvicorn)
- `docker-compose.yml` mit Volume für persistente Daten
- nginx Reverse-Proxy: `/save`, `/validate`, `/bi/`, `/auth/`, `/admin/` → Backend
- `.dockerignore`, `.gitignore`

---

## 🔲 Geplant

### Kurzfristig (offen)

| # | Aufgabe | Status |
|---|---------|--------|
| – | LDAP mit echtem AD testen | 🔲 |
| – | Checkmk-Auth live testen | 🔲 |
| – | Preview-Modal mit echten CMK-States (Livestatus / REST-API) | 🔲 |
| – | Unresolved-Objects-Modal nach Validierung | 🔲 |
| – | Orthogonales Routing mit vollständiger Avoidance | 🔲 |
| – | Node-State-Farben live (OK=grün / WARN=gelb / CRIT=rot) | 🔲 |
| – | Smart-Guides (Abstand-Anzeige beim Verschieben) | 🔲 |
| – | Keyboard-Shortcut-Übersicht (? Modal) | 🔲 |

---

### Phase 1 – Production-Ready (2–3 Wochen)

| # | Aufgabe | Aufwand |
|---|---------|---------|
| P1.1 | **Persistentes Audit-Log** – SQLite oder Datei-Backend statt localStorage; UI-Filter + Export | 3–4 Tage |
| P1.2 | **Erweiterte Validierung** – Zyklen, ungenutzte Rule Packs, doppelte Suchregeln, Cross-Pack-Konflikte | 4–5 Tage |
| P1.3 | **i18n (Internationalisierung)** – Deutsch + Englisch; JSON-Dictionary-System (analog NagVis2) | 3–4 Tage |
| P1.4 | **Performance-Optimierung** bei >300 Nodes – Lazy Rendering, verbessertes Culling | 4–6 Tage |

---

### Phase 2 – NagVis2-Integration (3–5 Wochen)

| # | Aufgabe | Aufwand |
|---|---------|---------|
| P2.1 | **BI-Gadget für NagVis2** – neuer Gadget-Typ `ui4bi`; BI-Editor oder fertige BI-Regel als Widget in 2D-Maps platzierbar | 5–7 Tage |
| P2.2 | **Shared Authentication** – JWT-Weitergabe zwischen NagVis2 und ui-4-bi; Single-Sign-On | 3–4 Tage |
| P2.3 | **Deep-Linking & Embed-Modus** – `?map=bi-xyz&embed=true&readonly=true`; Iframe/Modal-Einbettung | 3–4 Tage |
| P2.4 | **Bidirektionale Kommunikation** – `postMessage`-API: „Speichern" aus dem Gadget zurück an NagVis2 | 4–5 Tage |

**Ziel Phase 2:** BI-Editor direkt als Gadget in einer NagVis2-Map platzieren und bedienen.

---

### Phase 3 – Erweiterung & Enterprise (4–6 Wochen)

| # | Aufgabe | Aufwand |
|---|---------|---------|
| P3.1 | **Checkmk REST API v2 volle Unterstützung** – neue BI-API-Endpunkte (CMK 2.4 / 3.0) | 5–7 Tage |
| P3.2 | **BI-Templates / Vorlagen** – wiederverwendbare Sub-Graphen; Template-Bibliothek | 4–6 Tage |
| P3.3 | **PDF / PNG Export** – BI-Graph als Bild mit aktuellem Status (für Reports + Doku) | 3–5 Tage |
| P3.4 | **Theme-Sync mit NagVis2** – CSS Design-Tokens von NagVis2 übernehmen; Dark/Light synchron | 2–3 Tage |

---

### Phase 4 – Nice-to-have & Zukunft

| # | Aufgabe |
|---|---------|
| P4.1 | **Versionierung / Graph-History** – Git-ähnlich im Backend; Diff-Ansicht, Rollback |
| P4.2 | **Auto-Suggest** für Suchregeln basierend auf realen CMK-Daten (Hosts / Services aus REST API) |
| P4.3 | **Plugin-System** für eigene Node-Typen und Gadgets |
| P4.4 | **Mobile / Touch** – Pinch-Zoom, Touch-Drag; responsive Breakpoints für Tablets in Leitzentralen |
| P4.5 | **Integration mit nagvis3d-up-side-down** – BI-Status als 3D-Node-Typ visualisieren |

---

## 📊 Gesamtaufwand-Schätzung

| Ziel | Aufwand |
|---|---|
| Version 1.0 produktiv + Basis-NagVis2-Integration | 4–6 Wochen |
| Starke NagVis2-Integration (BI-Gadget + SSO) | 8–10 Wochen |
| Vollständiges Enterprise-BI-Tool | 3–4 Monate |

---

## 🏗️ Architektur

```
ui-4-bi/
├── src/
│   ├── index.html              ← App-Shell, Dialoge, Toolbar
│   ├── main.js                 ← Entry-Point, Modul-Init
│   ├── main.py                 ← FastAPI-Backend (Save, Validate, Auth, Audit)
│   ├── auth_manager.py         ← Auth-Kette: lokal → LDAP → CMK
│   ├── user_store.py           ← Benutzerverwaltung (PBKDF2, JSON-Store)
│   ├── requirements.txt
│   └── js/
│       ├── app.js              ← Haupt-Anwendungslogik
│       ├── core/               ← State, History (Undo/Redo), Graph-Modell
│       ├── interactions/       ← Drag, Select, Connect, Waypoints
│       ├── renderer/           ← Canvas, Edge-SVG, DOM-Pooling
│       ├── ui/                 ← Inspector, Toolbar, Panels, Dialoge
│       └── utils/              ← Geometrie, CMK-Converter, Validierung
├── tests/
│   ├── backend/                ← pytest (API, Auth, User-Store)
│   └── frontend/               ← Vitest (Geometrie, CMK-Converter, Auth)
├── docker/nginx.conf
├── docker-compose.yml
├── Dockerfile / Dockerfile.backend
├── docs/handbuch.md
├── FEATURES.md                 ← Diese Datei
├── todo.md
└── README.md
```

---

## 🔗 Bezug zu NagVis2 und nagvis3d

| Projekt | Geplante Verbindung |
|---|---|
| **nagvis-kurz-vor-2** | BI-Gadget-Typ in `gadget-renderer.js`; Shared JWT-Auth; `?embed=true`-Modus |
| **nagvis3d-up-side-down** | BI-Status als 3D-Node-Typ; Farb-Mapping analog zu NagVis3D-Statuscodes |
