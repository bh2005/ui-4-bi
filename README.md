# ui-4-bi

Ein Visio‑ähnlicher, browserbasierter Editor für Check_MK BI‑Regeln — Ziel ist ein produktiv nutzbarer Editor zum grafischen Erstellen, Bearbeiten, Validieren und Dry‑Runen von BI‑Regeln.

Kurz: dieses Repository enthält das Frontend‑Scaffold für das MVP (Phase 1: Interaktions‑Polish — Ports, Inspector, Layers‑UI). Weitere Phasen sind in `next.md` beschrieben.

## Inhalt dieses README
- Übersicht & Ziel
- Schnellstart (lokal)
- Projektstruktur (Scaffold)
- Phase‑1 Checklist (aktuelle Tasks)
- Entwicklung / Contribution Guide
- Branching & PR Workflow (Beispiele)
- Hinweise / ToDos
- Kontakt

---

## Ziel & Scope
Gesamtziel (MVP): Einen produktiv nutzbaren, Visio‑ähnlichen BI‑Editor liefern, der Check_MK BI‑Regeln visuell abbildet, bis ca. Ende April / Mitte Mai 2026 (siehe `next.md`).

Phase 1 (aktueller Fokus)
- Ports: Port‑to‑Port Verbindungen, Hover/Drag Feedback
- Inspector: Dynamischer Inspector mit Autocomplete (Mock)
- Layers‑UI: Layer Liste, Sichtbarkeit & Locking
Diese Phase liefert die grundlegende Interaktion und UX‑Fähigkeiten.

---

## Schnellstart (lokal)
Das Projekt ist statisch / clientseitig. Der einfachste Weg, die Demo lokal zu öffnen:

1) Mit Python HTTP Server (empfohlen, schnell)
```sh
# aus dem Repo-Root:
python3 -m http.server 8000
# im Browser öffnen:
# http://localhost:8000/3/index.html
