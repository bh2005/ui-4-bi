# To-Do – CMK BI Visual Editor

> Stand: 2026-03-31 | Ziel-MVP: Ende April / Mitte Mai 2026

---

## Aktuell (Phase 1 – Interaktions-Polish)

alle Issues erledigt → siehe Erledigt-Liste unten

---

## Phase 2 – CMK-Integration

- [ ] FastAPI-Endpoints für echte Check_MK-Daten anpassen (`main.py`)
- [ ] Preview-Modal: echte States vom Backend laden + auf Canvas highlighten
- [ ] Import/Export echtes BI-Format (UI-JSON ↔ CMK)
- [ ] Unresolved-Objects-Modal nach Validierung

---

## Bugs / Kleinigkeiten

- [ ] ES-Modul-Struktur im Browser testen (zirkuläre Imports prüfen)
- [ ] `struktur.txt` im `src/`-Ordner entfernen (veraltet)
- [ ] Waypoint-Handles bei Bézier-Modus nach Layout-Wechsel zurücksetzen
- [ ] Snap-Grid-Größe konfigurierbar machen (aktuell hardcodiert 20px)

---

## Erledigt

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
- [x] Parallele Kanten: ≥ 2px Abstand
- [x] Zoom zur Mausposition
- [x] Performance: RAF-Throttling, Viewport-Culling, DOM-Pooling
- [x] Audit-Log (in-memory, localStorage, CSV-Export)
- [x] Benutzername / User-Badge
- [x] ES-Modul-Refactoring (19 Module, kein Build-Tool)
- [x] `3/` → `src/` umbenannt, alte Scaffolds entfernt
- [x] Ports (4 Port-Dots, Port-Drag, fromPort/toPort in Edge)
- [x] Inspector ausbauen (Farb-Picker, Autocomplete, Routing-Toggle, Layer-Select)
- [x] Layers-UI (Layer-Liste, toggle/lock, Node-Zuweisung)
- [x] Connect-Modus verbessern (Tooltip, Rechtsklick-Abbrechen)
