# CMK BI Visual Editor

**Browserbasierter, Visio-ähnlicher Editor für Checkmk BI-Regelwerke**

Grafisches Erstellen, Bearbeiten und Exportieren von Checkmk BI-Regelwerken — kein Build-Tool, kein Framework, pure ES-Module + FastAPI-Backend.

![Backend Tests](https://github.com/bh2005/ui-4-bi/actions/workflows/tests.yml/badge.svg?job=backend)
![Frontend Tests](https://github.com/bh2005/ui-4-bi/actions/workflows/tests.yml/badge.svg?job=frontend)
[![Features](https://img.shields.io/badge/Features-ansehen-orange)](FEATURES.md)

---

## Features

| Bereich | Details |
|---|---|
| **Node-Typen** | BI Aggregator, Host, Service, Host-Gruppe, Service-Gruppe, Andere BI, Host-Suchregel, Service-Suchregel |
| **Kanten** | Gerade + Bézier; Waypoints; gerundete Ecken; parallele Kanten; 4 Pfeilstile × 3 Größen |
| **Edit** | Multi-Select (Shift+Klick, Marquee); Align & Distribute; Undo/Redo (100 Schritte); Inline-Edit |
| **Auto-Layout** | Sugiyama TD/LR; Raster-Ausrichten; Barycenter-Kreuzungsminimierung; animierte Übergänge |
| **Ports** | 4 Port-Dots pro Node (top / right / bottom / left); `fromPort`/`toPort` in Edge gespeichert |
| **Inspector** | Farb-Picker; Autocomplete; Routing-Toggle; Layer-Zuordnung; Aggregation-Typ; Multi-Select-Align |
| **Layers** | Sichtbarkeit + Lock; Node-Zuweisung; zIndex-Verwaltung |
| **Rule Packs** | Pack-ID, Titel, Contact-Groups; korrekt beim CMK-Export/Import |
| **CMK-Integration** | Export + Import als Checkmk BI Pack JSON; alle CMK-Typen; Aggregationsfunktionen |
| **Preview** | Mock-Vorschau (simulierte States); echter Backend-Aufruf wenn `/bi/preview` verfügbar |
| **Authentifizierung** | JWT (HS256, 8h); lokal → LDAP → Checkmk Auth-Kette; Admin-UI; `AUTH_ENABLED=false` |
| **Audit-Log** | In-Memory + localStorage; CSV-Export; Suche + Filter |
| **Performance** | RAF-Throttling; Viewport-Culling; DOM-Pooling; getestet bis 2k Nodes |
| **Dark / Light Theme** | Persistent; WCAG-AA-Kontrast im Light-Mode |
| **Tests & CI** | pytest (~50 Fälle) + Vitest (~50 Fälle); GitHub Actions CI; Status-Badges |
| **Docker** | nginx + FastAPI; Health-Probes; Volume für persistente Daten |

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

### Option C – Docker (empfohlen für Produktion)
```sh
docker compose up --build
# → http://localhost:80
```

---

## Konfiguration

**Umgebungsvariablen (optional, z. B. in `.env`):**

| Variable | Standard | Beschreibung |
|---|---|---|
| `AUTH_ENABLED` | `false` | Auth aktivieren (`true` = Login erforderlich) |
| `LDAP_URL` | — | z. B. `ldap://dc.example.com:389` |
| `LDAP_BIND_DN` | — | Service-Account-DN |
| `LDAP_BIND_PASSWORD` | — | Service-Account-Passwort |
| `LDAP_USER_BASE` | — | z. B. `ou=users,dc=example,dc=com` |
| `LDAP_ADMIN_GROUP` | — | DN der Admin-Gruppe |
| `CMK_URL` | — | Checkmk-URL für CMK-Auth |
| `JWT_EXPIRE_MINUTES` | `480` | Token-Laufzeit (Minuten) |

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

## Projektstruktur

```
ui-4-bi/
├── Dockerfile                  ← nginx + Frontend
├── Dockerfile.backend          ← FastAPI / uvicorn
├── docker-compose.yml
├── docker/
│   └── nginx.conf              ← Proxy /save /validate /audit → backend
├── src/
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
├── tests/
│   ├── backend/                ← pytest (API, Auth, User-Store)
│   └── frontend/               ← Vitest (Geometrie, CMK-Converter, Auth)
├── docs/
│   └── handbuch.md
├── FEATURES.md                 ← Feature-Übersicht & Roadmap
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

---

## Tech-Stack

| Bereich | Technologie |
|---|---|
| Frontend | Vanilla JS, ES-Module, Tailwind CSS (CDN), Lucide Icons |
| Backend | Python 3.12 / FastAPI / uvicorn / PyJWT / ldap3 |
| Container | nginx 1.27-alpine + python:3.12-slim |
| Kein Build-Tool | direkt im Browser lauffähig |

---

## Aktuelle Änderungen

### 2026-04-05
- **Rule Packs** — Pack-ID, Titel und Contact-Groups in der Sidebar; vollständig beim CMK-Export/-Import
- **Dynamische Suchregeln** — Node-Typen `hostregex` / `serviceregex`; Round-trip-fähig
- **CI** — Node.js 24, 56/56 Backend-Tests grün

### 2026-04-02
- **GitHub Actions CI** — parallele Jobs für Backend (pytest) und Frontend (Vitest); Status-Badges

### Frühere Highlights
- JWT-Authentifizierung (lokal · LDAP · Checkmk-Auth-Kette)
- Undo/Redo (100 Schritte), Auto-Layout (TD/LR/Grid), Ports, Waypoints
- Docker-ready (nginx + FastAPI), Health-Probes

---

## Links

| | |
|---|---|
| ✨ [Feature-Übersicht](FEATURES.md) | Was ist gebaut, was ist geplant |
| 📋 [Changelog](src/changelog.txt) | Änderungshistorie |
| 📚 [Handbuch](docs/handbuch.md) | Benutzerhandbuch |
| 🗺 [nagvis-kurz-vor-2](../nagvis-kurz-vor-2/) | NagVis2 Backend + 2D-Maps (geplante Integration) |
| 🎲 [nagvis3d-up-side-down](../nagvis3d-up-side-down/) | 3D-Visualisierung (geplante Integration) |

---

**Lizenz:** MIT  
**Projektstatus:** Beta (funktioniert stabil, aktive Weiterentwicklung)  
**Version:** 1.0 Beta (April 2026)
