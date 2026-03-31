# CMK BI Visual Editor

Browserbasierter, Visio-ähnlicher Editor zum grafischen Erstellen, Bearbeiten und Validieren von **Check_MK BI-Regeln** — kein Build-Tool, kein Framework, pure ES-Module.

---

## Schnellstart

```sh
cd src/
python3 -m http.server 8000
# → http://localhost:8000
```

Oder mit dem FastAPI-Backend (Save / Validate / Audit):

```sh
cd src/
pip install fastapi uvicorn
uvicorn main:app --reload --port 8000
```

---

## Projektstruktur

```
ui-4-bi/
├── src/                        ← Anwendung
│   ├── index.html
│   ├── main.py                 ← FastAPI Backend
│   ├── changelog.txt
│   └── js/
│       ├── app.js              ← Einstiegspunkt
│       ├── core/               ← State, Actions, Konstanten
│       ├── renderer/           ← Node-, Edge-, Grid-Rendering
│       ├── interactions/       ← Mouse, Keyboard, Drag, Marquee
│       ├── ui/                 ← Inspector, Toolbar, Kontextmenü, Audit
│       └── utils/              ← Geometrie, DOM-Helpers
├── docs/
│   └── handbuch.md             ← Benutzerhandbuch
├── FEATURES.md                 ← Feature-Übersicht & Roadmap
├── todo.md                     ← Aktuelle Aufgaben
└── README.md
```

---

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [docs/handbuch.md](docs/handbuch.md) | Benutzerhandbuch (Bedienung, Shortcuts) |
| [FEATURES.md](FEATURES.md) | Implementierte Features & Roadmap |
| [todo.md](todo.md) | Aktuelle Entwicklungsaufgaben |
| [src/changelog.txt](src/changelog.txt) | Änderungshistorie |

---

## Tech-Stack

- **Frontend**: Vanilla JS, ES-Module, Tailwind CSS (CDN), Lucide Icons
- **Backend**: Python / FastAPI
- **Kein Build-Tool** — direkt im Browser lauffähig
