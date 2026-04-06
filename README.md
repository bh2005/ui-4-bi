# CMK BI Visual Editor

![Backend Tests](https://github.com/bh2005/ui-4-bi/actions/workflows/tests.yml/badge.svg?job=backend)
![Frontend Tests](https://github.com/bh2005/ui-4-bi/actions/workflows/tests.yml/badge.svg?job=frontend)

Browserbasierter, Visio-ähnlicher Editor zum grafischen Erstellen, Bearbeiten und Exportieren von **Checkmk BI-Regelwerken** — kein Build-Tool, kein Framework, pure ES-Module.

---

## Schnellstart

### Option A – Einfacher Webserver (nur Frontend)
```sh
cd src/
python3 -m http.server 8000
# → http://localhost:8000
```

### Option B – Mit FastAPI-Backend (Save / Validate / Audit / Auth)
```sh
cd src/
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Beim ersten Start wird automatisch ein Benutzer `admin` / `admin` angelegt — sofort ändern!

**Umgebungsvariablen (optional, z. B. in `.env`):**

| Variable | Standard | Beschreibung |
|---|---|---|
| `AUTH_ENABLED` | `false` | Auth aktivieren (`true` = Login erforderlich; Standard: anonymous-Admin) |
| `LDAP_URL` | — | z. B. `ldap://dc.example.com:389` |
| `LDAP_BIND_DN` | — | Service-Account-DN |
| `LDAP_BIND_PASSWORD` | — | Service-Account-Passwort |
| `LDAP_USER_BASE` | — | z. B. `ou=users,dc=example,dc=com` |
| `LDAP_ADMIN_GROUP` | — | DN der Admin-Gruppe |
| `CMK_URL` | — | Checkmk-URL für CMK-Auth |
| `JWT_EXPIRE_MINUTES` | `480` | Token-Laufzeit (Minuten) |

### Option C – Docker (empfohlen für Produktion)
```sh
docker compose up --build
# → http://localhost:80
```

---

## Features

### Editor
- Grafischer Drag-and-Drop Editor für BI-Regelwerke
- Node-Typen: **BI Aggregator**, **Host**, **Service**, **Host-Gruppe**, **Service-Gruppe**, **Andere BI**
- Verbindungen mit gerader oder Bézier-Routing, Waypoints, gerundete Ecken
- Pfeilstile: Keiner, Chevron, Thin, Dot — in 3 Größen (Kl/Mi/Gr)
- 4 Port-Dots pro Node (top/right/bottom/left) für präzise Verbindungen

### Layout & Navigation
- Auto-Layout: Top→Bottom, Left→Right, Raster-Ausrichten
- Sugiyama-Hierarchie mit Barycenter-Kreuzungsminimierung
- Zoom zur Mausposition, Pan, Grid-Snap mit Snaplines
- Viewport-Culling für große Graphen

### Inspektion & Bearbeitung
- Properties-Inspector für Nodes und Kanten
- Inline-Edit per Doppelklick
- Multi-Select (Shift+Klick, Marquee), Align & Distribute
- Undo/Redo (100 Schritte)
- Kontextmenü (Node & Kante)
- Layers: Sichtbarkeit, Lock, Node-Zuweisung

### Checkmk-Integration
- **Export als Checkmk BI Pack** (vollständiges JSON-Regelwerk)
- **Import von Checkmk BI Packs** mit automatischem Layout
- Alle CMK Node-Typen: `state_of_host`, `state_of_service`, `host_search`, `service_search`, `call_a_rule`
- Alle Aggregations-Funktionen: `worst`, `best`, `count_ok`
- **Rule Packs** — Pack-ID, Titel und Contact-Groups direkt in der Sidebar pflegen; werden beim Export korrekt eingebettet
- **Dynamische Suchregeln** — Node-Typen `hostregex` und `serviceregex` mit Regex-Pattern; werden beim Export als `host_search`/`service_search` ausgegeben und beim Import erkannt

### Authentifizierung & Benutzerverwaltung
- **Lokale Benutzer** (PBKDF2-SHA256, data/users.json)
- **LDAP / Active Directory** (ldap3, Bind-DN, Admin-Gruppe)
- **Checkmk-Auth** (REST-API, Rollen-Ermittlung aus CMK-Profil)
- Auth-Kette: lokal → LDAP → Checkmk
- JWT-Token (HS256, 8h Laufzeit, Secret persistent)
- Admin-UI: Benutzer anlegen, bearbeiten, aktivieren/deaktivieren, löschen
- `AUTH_ENABLED=false` (Standard) → kein Login, anonymous-Admin

### System
- Dark / Light Theme (persistent)
- Audit-Log (in-memory, CSV-Export)
- Save/Load (FastAPI-Backend oder localStorage-Fallback)
- Graph-Validierung (Zyklen-Erkennung)
- Docker-ready: nginx + FastAPI, Health-Probes

---

## Projektstruktur

```
ui-4-bi/
├── Dockerfile                  ← nginx + Frontend
├── Dockerfile.backend          ← FastAPI / uvicorn
├── docker-compose.yml
├── docker/
│   └── nginx.conf              ← Proxy /save /validate /audit → backend
├── src/                        ← Anwendung
│   ├── index.html
│   ├── main.py                 ← FastAPI Backend
│   ├── auth_manager.py         ← JWT, LDAP, Checkmk Auth, FastAPI-Dependencies
│   ├── user_store.py           ← Lokale Benutzerdatenbank (PBKDF2)
│   ├── requirements.txt
│   ├── changelog.txt
│   └── js/
│       ├── app.js              ← Einstiegspunkt
│       ├── core/               ← state.js, actions.js, constants.js, theme.js, auth.js
│       ├── renderer/           ← node-renderer.js, edge-renderer.js, renderer.js
│       ├── interactions/       ← drag, connect, marquee, keyboard, mouse
│       ├── ui/                 ← inspector.js, toolbar.js, context-menu.js,
│       │                          audit-ui.js, layers-ui.js, login.js, admin-ui.js
│       └── utils/              ← geometry.js, dom-utils.js, cmk-bi-converter.js
├── docs/
│   └── handbuch.md
├── FEATURES.md
├── todo.md
└── README.md
```

---

## Tests ausführen

### Backend (pytest)
```sh
cd src/
pip install -r requirements.txt
cd ..
pytest
```

### Frontend (Vitest)
```sh
npm install
npm test              # einmalig
npm run test:watch    # im Watch-Modus
npm run test:coverage # mit Coverage-Report
```

| Test-Datei | Getestetes Modul |
|---|---|
| `tests/backend/test_user_store.py` | PBKDF2-Hashing, CRUD, Authentifizierung |
| `tests/backend/test_auth_manager.py` | JWT create/decode, require_auth, require_admin |
| `tests/backend/test_api.py` | API-Endpoints (login, users, save, validate) |
| `tests/frontend/geometry.test.js` | snapToGrid, bezierPoint, getPortPoint |
| `tests/frontend/cmk-converter.test.js` | exportToCMK, importFromCMK |
| `tests/frontend/auth.test.js` | Token-Handling, apiFetch, Session |

---

## Tastaturkürzel

| Kürzel | Aktion |
|---|---|
| `Ctrl+Z` | Rückgängig |
| `Ctrl+Y` | Wiederholen |
| `Ctrl+S` | Speichern |
| `Delete` / `Backspace` | Ausgewähltes löschen |
| `Escape` | Auswahl aufheben / Connect-Modus abbrechen |
| `Shift+Klick` | Multi-Select |
| `Doppelklick` Node | Inline-Edit |
| `Rechtsklick` | Kontextmenü |

---

## Tech-Stack

| Bereich | Technologie |
|---|---|
| Frontend | Vanilla JS, ES-Module, Tailwind CSS (CDN), Lucide Icons |
| Backend | Python 3.12 / FastAPI / uvicorn / PyJWT / ldap3 |
| Container | nginx 1.27-alpine + python:3.12-slim |
| Kein Build-Tool | direkt im Browser lauffähig |

---

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [docs/handbuch.md](docs/handbuch.md) | Benutzerhandbuch |
| [FEATURES.md](FEATURES.md) | Feature-Übersicht & Roadmap |
| [todo.md](todo.md) | Entwicklungsaufgaben |
| [statistik.md](statistik.md) | Projektstatistik (LOC, Zeitleiste, Token-Schätzung) |
| [src/changelog.txt](src/changelog.txt) | Änderungshistorie |

---

## Aktuelle Änderungen

### 2026-04-05
- **Rule Packs** — Pack-ID, Titel und Contact-Groups in der Sidebar; werden beim CMK-Export und -Import vollständig berücksichtigt
- **Dynamische Suchregeln** — neue Node-Typen `hostregex` / `serviceregex` mit Live-Vorschau im Inspector; Round-trip-fähig (Export + Import)
- **CI** — Node.js 24, 56/56 Backend-Tests grün

### 2026-04-02
- **GitHub Actions CI** — parallele Jobs für Backend (pytest) und Frontend (Vitest), Coverage-Artefakt, Status-Badges

### Frühere Highlights
- JWT-Authentifizierung (lokal · LDAP · Checkmk-Auth-Kette)
- Undo/Redo (100 Schritte), Auto-Layout (TD/LR/Grid), Ports, Waypoints
- Docker-ready (nginx + FastAPI), Health-Probes
