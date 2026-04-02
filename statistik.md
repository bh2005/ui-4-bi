# Projektstatistik – UI4BI Visual BI Editor

> Stand: 2026-04-02

---

## Zeitlinie

| Datum | Meilenstein |
|---|---|
| 2026-03-27 | **Projektstart** — Fundament: Multi-Select, Inline-Edit, Waypoints, Grid-Snap, Undo/Redo, Save/Validate |
| 2026-03-28 | Performance-Optimierungen (RAF, Viewport-Culling, DOM-Pooling) + Audit-Log / User-Badge |
| 2026-03-29 | Kontextmenü + Edge-Routing (Gerade / Bézier) |
| 2026-03-30 | Auto-Layout (Sugiyama TD/LR/GRID, Barycenter-Minimierung) |
| 2026-03-31 | ES-Modul-Refactoring (2298-Zeilen-Monolith → 24 Module), Port-Dots, Inspector-Ausbau, Layers-UI |
| 2026-04-01 | Neue Node-Typen, Dark/Light-Theme, Pfeilstile, CMK-Import/Export, Docker, **Authentifizierung** (JWT/LDAP/CMK) |
| 2026-04-02 | Session-Ablauf-Timer, Passwort-Änderung, Bugfixes, Snap-Grid konfigurierbar |

**Entwicklungsdauer:** 7 Tage  
**Arbeitsweise:** KI-assistiert (Claude Sonnet 4.6) – vollständig in Claude Code / Claude Agent SDK

---

## Codeumfang

### Aktive Quelldateien

| Kategorie | Dateien | Zeilen |
|---|---|---|
| JavaScript (ES-Module) | 24 | 3 604 |
| Python (FastAPI-Backend) | 3 | 672 |
| HTML | 1 | 515 |
| **Aktiver Code gesamt** | **28** | **4 791** |
| Legacy `main.js` (Monolith, nicht aktiv) | 1 | 2 298 |

### Alle Projektdateien

| Kategorie | Anzahl |
|---|---|
| Quelldateien (JS, Python, HTML) | 28 |
| Konfiguration (Docker, nginx, .env, .gitignore) | 7 |
| Dokumentation (.md, changelog.txt) | 6 |
| **Gesamt** | **43** |

### Größte Dateien (aktiver Code)

| Datei | Zeilen | Inhalt |
|---|---|---|
| `src/js/ui/toolbar.js` | 398 | Auto-Layout, CMK-Import/Export, Snap |
| `src/js/ui/inspector.js` | 380 | Node/Edge-Properties, Autocomplete |
| `src/main.py` | 379 | FastAPI-Endpoints |
| `src/js/ui/admin-ui.js` | 351 | Benutzerverwaltungs-Modal |
| `src/js/renderer/edge-renderer.js` | 278 | SVG-Kanten, Marker, Waypoint-Drag |
| `src/js/utils/cmk-bi-converter.js` | 268 | CMK BI Pack Im-/Export |
| `src/js/ui/login.js` | 256 | Login-Modal, Passwort-Änderung |
| `src/js/renderer/node-renderer.js` | 236 | Node-DOM, DOM-Pooling |
| `src/js/ui/audit-ui.js` | 209 | Audit-Modal, Toast, User-Badge |
| `src/js/core/actions.js` | 208 | Undo/Redo, Select, Align, Connect |

---

## Architektur

### Frontend – ES-Module-Baum

```
js/app.js                    ← Einstiegspunkt (~90 LOC)
├── core/
│   ├── state.js             ← Zentraler Mutable State
│   ├── actions.js           ← Alle State-Mutationen
│   ├── constants.js         ← Node-Typen, Layout-Konstanten
│   ├── auth.js              ← JWT, apiFetch, Token-Timer
│   └── theme.js             ← Dark/Light Toggle
├── renderer/
│   ├── renderer.js          ← RAF-Redraw, Transform
│   ├── node-renderer.js     ← DOM-Pooling, Node-Elemente
│   ├── edge-renderer.js     ← SVG-Kanten, Waypoint-Drag
│   └── grid-renderer.js     ← Snaplines
├── interactions/
│   ├── drag-handler.js      ← Node-Drag, Multi-Drag
│   ├── connect-handler.js   ← Canvas-Drop, Port-Drag
│   ├── marquee-handler.js   ← Lasso-Selection
│   ├── keyboard-handler.js  ← Ctrl+Z/Y/S, Delete, ESC
│   └── mouse-handler.js     ← Zoom, Pan, Klick
├── ui/
│   ├── toolbar.js           ← Alle Toolbar-Aktionen
│   ├── inspector.js         ← Properties-Panel
│   ├── context-menu.js      ← Rechtsklick-Menüs
│   ├── audit-ui.js          ← Audit-Modal, Toast
│   ├── layers-ui.js         ← Layer-Panel
│   ├── login.js             ← Login-Modal, Passwort-Änderung
│   └── admin-ui.js          ← Benutzerverwaltung
└── utils/
    ├── geometry.js          ← snapToGrid, Kantenpunkte, Bézier
    ├── dom-utils.js         ← escHtml
    └── cmk-bi-converter.js  ← CMK BI Pack Konvertierung
```

### Backend – Python/FastAPI

```
src/
├── main.py          ← REST-Endpoints: save, validate, audit, bi/*, auth, users
├── auth_manager.py  ← JWT, LDAP (ldap3), Checkmk REST-Auth, FastAPI-Dependencies
└── user_store.py    ← Lokale Benutzer-DB (PBKDF2-SHA256, data/users.json)
```

---

## Features (Überblick)

| Bereich | Anzahl Features |
|---|---|
| Canvas & Interaktion | 12 |
| Node-Typen | 6 |
| Kanten & Routing | 8 |
| Auto-Layout | 4 Modi |
| CMK-Integration | 6 Node-Mappings, 3 Aggregations-Funktionen |
| Authentifizierung | 3 Auth-Backends |
| Benutzerverwaltung | 5 CRUD-Operationen |
| Darstellung | Dark/Light, 4 Pfeilstile × 3 Größen = 12 Varianten |

---

## Token-Schätzung

> Hinweis: Die Werte sind Schätzungen auf Basis typischer Claude Code-Sitzungsgrößen.

| Posten | Geschätzt |
|---|---|
| Sessions (Konversationen) | ~6–8 |
| Input-Tokens pro Session | ~100 000 – 300 000 |
| Output-Tokens pro Session | ~30 000 – 80 000 |
| **Gesamt Input** | **~800 000 – 1 500 000** |
| **Gesamt Output** | **~200 000 – 500 000** |
| **Gesamt kombiniert** | **~1 000 000 – 2 000 000** |

Der Großteil des Kontexts entfiel auf:
- Vollständiges Lesen und Schreiben der `main.js` (2298 LOC) beim Refactoring
- Wiederholtes Einlesen von `index.html` und `toolbar.js` über mehrere Sessions
- Ausführliche Planungsdiskussionen (Auth-Architektur, CMK-Format-Analyse)

---

## Besonderheiten

- **Kein Build-Tool** — läuft nativ als ES-Module direkt im Browser
- **Kein Frontend-Framework** — Vanilla JS, ~4,8k aktive LOC
- **Test-Suite** — pytest (Backend) + Vitest (Frontend), 6 Testdateien, ~100 Testfälle
- **Vollständig KI-generiert** — alle 43 Dateien wurden in Claude Code erstellt oder maßgeblich überarbeitet
- **Iterativer Aufbau** — von 1 Datei (main.js, 2298 LOC) zu 28 aktiven Moduldateien in 7 Tagen
