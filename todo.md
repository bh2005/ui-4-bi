# To-Do – CMK BI Visual Editor

> Stand: 2026-04-23 | Ziel-MVP: Ende April / Mitte Mai 2026

---

## Offen – Phase 3 (Auth & Admin)

- [ ] **LDAP testen** — Integration mit echtem AD testen (LDAP_URL, LDAP_BIND_DN, LDAP_USER_BASE, LDAP_ADMIN_GROUP)
- [ ] **Checkmk-Auth testen** — Login via CMK REST API verifizieren
- [x] **CMK-SSL-Verify konfigurierbar** — `verify=False` bei allen CMK-REST-Aufrufen durch `CMK_SSL_VERIFY`-Env-Var ersetzt (Default weiterhin `false`, `true` für Produktivbetrieb empfohlen) ✅ (2026-04-23)
- [x] **Login-Rate-Limiting** — max. `LOGIN_MAX_ATTEMPTS` (Default 5) Fehlversuche pro IP+Benutzername innerhalb `LOGIN_WINDOW_SECONDS` (Default 60s), danach HTTP 429; In-Memory-Zähler in `src/main.py` ✅ (2026-04-23)

## Offen – Phase 2 (CMK-Integration)

- [x] **Rule Packs** — Regelgruppen mit Name + Contact-Group verwalten, beim Export auf `pack_id` mappen ✅ (2026-04-05)
- [x] **Dynamische Suchregel** — Node-Typ `hostregex` / `serviceregex` mit Regex-Pattern; Export als `host_search`/`service_search` ✅ (2026-04-05)
- [ ] **Preview-Modal** — echte States vom Backend laden (CMK Livestatus / REST-API) und auf Canvas highlighten
- [ ] **Unresolved-Objects-Modal** — nach Validierung unbekannte Hosts/Services anzeigen

---

## Offen – Bugs / Kleinigkeiten

- [x] Waypoint-Handles bei Bézier-Modus nach Layout-Wechsel zurücksetzen
- [x] Snap-Grid-Größe konfigurierbar machen (10 / 20 / 40 / 80 px, persistent)

### Tests
- [x] pytest Backend-Tests (user_store, auth_manager, API-Endpoints) — ~50 Fälle
- [x] Vitest Frontend-Tests (geometry, cmk-converter, auth) — ~50 Fälle
- [x] pytest.ini, vitest.config.js, package.json

---

## Erledigt

### Auth & Benutzerverwaltung (Ergänzungen)
- [x] Passwort-Änderung im UI (Key-Button, Modal, `/me/password`)
- [x] Session-Ablauf: JWT-Expiry-Timer (60s vor Ablauf → Login-Modal automatisch)
- [x] Abgelaufenes Token beim Start aus localStorage verworfen
- [x] `struktur.txt` entfernt (veraltet)

### Auth & Benutzerverwaltung
- [x] JWT-Authentifizierung (PyJWT, HS256, 8h Ablauf, Secret persistent)
- [x] Lokale Benutzer (PBKDF2-SHA256, data/users.json, Default-Admin)
- [x] LDAP-Authentifizierung (ldap3, LDAP_BIND_DN, LDAP_ADMIN_GROUP)
- [x] Checkmk-Authentifizierung (REST-API, Rollen-Ermittlung)
- [x] Auth-Kette: lokal → LDAP → Checkmk
- [x] FastAPI Dependencies: `require_auth`, `require_admin`
- [x] `AUTH_ENABLED=false` → alle Endpoints ohne Login, anonymous-Admin
- [x] Letzter-Admin-Schutz beim Löschen
- [x] Frontend: `auth.js` (Token, apiFetch, 401-Handler)
- [x] Frontend: `login.js` (Login-Modal, Badge-Update)
- [x] Frontend: `admin-ui.js` (Benutzerverwaltung-Modal)
- [x] index.html: Admin-Button, Logout-Button, user-badge-role
- [x] toolbar.js: apiFetch für save/validate

### CMK-Integration
- [x] Export als Checkmk BI Pack JSON (`exportToCMK`)
- [x] Import von Checkmk BI Pack JSON (`importFromCMK`) inkl. Auto-Layout
- [x] Alle CMK Node-Typen gemappt: `state_of_host`, `state_of_service`, `host_search`, `service_search`, `call_a_rule`
- [x] Aggregationsfunktionen: `worst`, `best`, `count_ok`

### Neue Node-Typen
- [x] Host-Gruppe (`hostgroup`)
- [x] Service-Gruppe (`servicegroup`)
- [x] Andere BI (`bi`) mit `biRef`-Feld und `↗ label`-Anzeige auf Node

### Darstellung & UX
- [x] Dark / Light Theme Toggle (persistent in localStorage)
- [x] Node-Labels im Light Mode: dunkelgrau (`#333333`)
- [x] Pfeilstile: Keiner (—), Chevron (▶), Thin (›), Dot (●)
- [x] Pfeilgröße: Klein / Mittel / Groß (SVG-Marker mit viewBox-Skalierung)
- [x] Gerundete Ecken bei orthogonalen Kanten (Quadratic-Bézier, r=14px)

### Docker
- [x] `Dockerfile` (nginx + Frontend)
- [x] `Dockerfile.backend` (FastAPI / uvicorn)
- [x] `docker-compose.yml` mit Volume für persistente Daten
- [x] nginx Reverse-Proxy für API-Endpoints
- [x] `.dockerignore`, `.gitignore`

### Phase 1 – Interaktions-Polish
- [x] Ports (4 Port-Dots, Port-Drag, `fromPort`/`toPort` in Edge)
- [x] Inspector ausbauen (Farb-Picker, Autocomplete, Routing-Toggle, Layer-Select)
- [x] Layers-UI (Layer-Liste, toggle/lock, Node-Zuweisung)
- [x] Connect-Modus (Tooltip, Rechtsklick-Abbrechen)

### Fundament
- [x] Multi-Select (Shift+Klick, Marquee, ESC)
- [x] Inline-Edit (Doppelklick)
- [x] Align & Distribute
- [x] Waypoint-Editing
- [x] Grid-Snap & Snaplines
- [x] Preview-Modal (Mock)
- [x] Undo/Redo (100 Schritte)
- [x] Kontextmenü (Node & Edge)
- [x] Edge-Routing: Gerade / Bézier umschaltbar
- [x] Auto-Layout (TD / LR / GRID) mit Barycenter-Minimierung
- [x] Orthogonale Waypoints + Skip-Layer-Bypass nach Layout
- [x] Zoom zur Mausposition
- [x] Performance: RAF-Throttling, Viewport-Culling, DOM-Pooling
- [x] Audit-Log (in-memory, localStorage, CSV-Export)
- [x] Benutzername / User-Badge
- [x] ES-Modul-Refactoring (20 Module, kein Build-Tool)
- [x] Save/Load (FastAPI-Backend + localStorage-Fallback)
- [x] Graph-Validierung (Zyklen-Erkennung per Kahn's Algorithm)
