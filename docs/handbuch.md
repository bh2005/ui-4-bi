# Benutzerhandbuch – CMK BI Visual Editor

## Inhalt
1. [Starten](#1-starten)
2. [Oberfläche](#2-oberfläche)
3. [Nodes erstellen](#3-nodes-erstellen)
4. [Nodes bearbeiten](#4-nodes-bearbeiten)
5. [Kanten (Verbindungen)](#5-kanten-verbindungen)
6. [Auswahl & Multi-Select](#6-auswahl--multi-select)
7. [Auto-Layout](#7-auto-layout)
8. [Zoom & Navigation](#8-zoom--navigation)
9. [Speichern & Export](#9-speichern--export)
10. [Audit-Log](#10-audit-log)
11. [Tastenkürzel](#11-tastenkürzel)

---

## 1 Starten

### Ohne Backend (statisch)
```sh
cd src/
python3 -m http.server 8000
```
Browser: `http://localhost:8000`

### Mit Backend (Save / Validate / Audit)
```sh
cd src/
pip install fastapi uvicorn
uvicorn main:app --reload --port 8000
```

---

## 2 Oberfläche

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar: Undo Redo | Speichern Validieren | Import      │
│           Export | Layout ↓TD | ⊞Snap | Vorschau        │
│           Audit | Benutzer | Zoom −  100%  +             │
├──────────┬──────────────────────────────┬───────────────┤
│ Palette  │                              │  Inspector    │
│          │        Canvas                │               │
│ BI Aggr. │  (Nodes & Kanten)            │  (Eigenschaf- │
│ Host     │                              │   ten der     │
│ Service  │                              │   Auswahl)    │
└──────────┴──────────────────────────────┴───────────────┘
```

**Palette** (links): Ziehbare Node-Typen auf den Canvas.  
**Canvas** (Mitte): Arbeitsfläche, endlos scrollbar.  
**Inspector** (rechts): Eigenschaften des ausgewählten Elements.

---

## 3 Nodes erstellen

### Per Drag & Drop
1. Element aus der Palette greifen (BI Aggregator / Host / Service)
2. Auf den Canvas ziehen und loslassen

### Duplizieren
Rechtsklick auf einen Node → **Duplizieren**

Der neue Node erscheint 40px versetzt vom Original.

---

## 4 Nodes bearbeiten

### Label ändern
- **Doppelklick** auf den Node → Eingabefeld erscheint direkt auf dem Node
- Enter bestätigt, ESC bricht ab
- Alternativ: Inspector → Feld „Label" bearbeiten

### Aggregation-Typ (nur BI Aggregator)
- Rechtsklick → Typ aus Liste wählen (AND / OR / Best / Worst / Best of N / Worst of N)
- Oder: Inspector → Dropdown „Aggregation-Typ"

### Verschieben
- Node anklicken und ziehen
- Bei Multi-Select: alle markierten Nodes bewegen sich gemeinsam

### Löschen
- Node auswählen → **Entf** oder **Backspace**
- Rechtsklick → **Löschen**
- Inspector → Button „Node löschen"

---

## 5 Kanten (Verbindungen)

### Verbindung erstellen
1. Node auswählen
2. Inspector → **„Mit anderem Knoten verbinden →"** klicken  
   *oder* Rechtsklick → **Verbinden mit…**
3. Canvas wechselt in Connect-Modus (Cursor: Fadenkreuz, Quell-Node pulsiert)
4. Ziel-Node anklicken → Kante wird erstellt
5. ESC bricht den Connect-Modus ab

### Routing-Modus wechseln
Rechtsklick auf eine Kante → **Gebogen (Bézier)** oder **Gerade**

| Modus | Verhalten |
|---|---|
| Gerade (Standard) | Orthogonale L-förmige Linie, Waypoints als Knicke |
| Gebogen | Bézier-Kurve, weicht Nodes automatisch aus |

### Waypoints (Knicke) hinzufügen
1. Kante auswählen (Klick) → grüne Handles erscheinen
2. Handle ziehen → neuer Wegpunkt wird eingefügt
3. Bestehenden Waypoint (gefüllter Kreis) doppelklicken → entfernen

### Kante löschen
- Kante auswählen → **Entf**
- Rechtsklick → **Verbindung löschen**

### Richtung umkehren
Rechtsklick auf Kante → **Richtung umkehren**

---

## 6 Auswahl & Multi-Select

| Aktion | Beschreibung |
|---|---|
| Klick auf Node/Kante | Einzelauswahl |
| Shift + Klick | Zur Auswahl hinzufügen / entfernen |
| Lasso (Drag auf freier Fläche) | Alle Nodes im Rechteck auswählen |
| ESC | Auswahl aufheben |

### Ausrichten (Multi-Select, ≥ 2 Nodes)
Im Inspector erscheint bei Multi-Select das Ausrichten-Panel:

| Button | Wirkung |
|---|---|
| ⬅ L | Links ausrichten |
| ⬌ H | Horizontal zentrieren |
| R ➡ | Rechts ausrichten |
| ⬆ O | Oben ausrichten |
| ⬍ V | Vertikal zentrieren |
| U ⬇ | Unten ausrichten |
| ⬌⬌ Verteilen H | Gleichmäßiger horizontaler Abstand |
| ⬍⬍ Verteilen V | Gleichmäßiger vertikaler Abstand |

---

## 7 Auto-Layout

Der **Layout-Button** in der Toolbar ordnet alle Nodes automatisch an.

| Klick | Verhalten |
|---|---|
| Hauptklick | Wechselt zwischen **↓ TD** und **→ LR** und führt Layout aus |
| Chevron ▾ | Öffnet Dropdown mit allen Modi |

| Modus | Beschreibung |
|---|---|
| ↓ TD (Top → Bottom) | Hierarchie von oben nach unten |
| → LR (Left → Right) | Hierarchie von links nach rechts |
| ⊞ Am Raster ausrichten | Snapped alle Nodes auf das 20px-Raster |

**Hinweis:** Das Layout überschreibt alle manuellen Positionen (Undo mit Ctrl+Z möglich).

### Grid-Snap
Toolbar → **⊞ Grid**-Button: Snap ein/aus. Bei aktivem Snap rasten Nodes beim Verschieben am 20px-Raster ein.

---

## 8 Zoom & Navigation

| Aktion | Beschreibung |
|---|---|
| Scroll-Rad | Zoom zur Mausposition |
| Toolbar + / − | Zoom in / out |
| Space + Drag | Canvas verschieben (Pan) |
| Mittelklick + Drag | Canvas verschieben (Pan) |

Zoom-Bereich: 25% – 400%

---

## 9 Speichern & Export

| Button | Funktion |
|---|---|
| Speichern | POST an `/save` (Backend), Fallback: localStorage |
| Validieren | POST an `/validate` (Backend prüft Regelintegrität) |
| Export | Download als `bi_graph.json` |
| Import | JSON-Datei laden (ersetzt aktuellen Graph) |

**Automatisches Speichern in localStorage:** Der Graph wird beim nächsten Start automatisch wiederhergestellt, wenn kein Backend verfügbar ist.

### JSON-Format
```json
{
  "nodes": [
    {
      "id": 1,
      "type": "aggregator",
      "label": "Frontend",
      "x": 320, "y": 280,
      "color": "#13d38e",
      "icon": "git-merge",
      "aggType": "best"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "from": 1, "to": 2,
      "routing": "straight",
      "waypoints": [{"x": 400, "y": 350}]
    }
  ]
}
```

---

## 10 Audit-Log

Jede Änderung wird automatisch geloggt (Zeitstempel, Benutzer, Aktion, Details).

**Öffnen:** Toolbar → **Audit**-Button

| Funktion | Beschreibung |
|---|---|
| Suche | Filtert nach Aktion, Details oder Benutzer |
| Filter | Auswahl einer bestimmten Aktion |
| CSV-Export | Download der aktuellen (gefilterten) Einträge |

**Benutzername setzen:** Klick auf das Benutzer-Badge (oben rechts) → Name eingeben.

---

## 11 Tastenkürzel

| Shortcut | Aktion |
|---|---|
| `Ctrl + Z` | Rückgängig |
| `Ctrl + Y` | Wiederholen |
| `Ctrl + S` | Speichern |
| `Entf` / `Backspace` | Ausgewähltes löschen |
| `ESC` | Connect-Modus beenden / Modal schließen / Auswahl aufheben |
| `Shift + Klick` | Multi-Select: Element hinzufügen |
| `Space + Drag` | Canvas verschieben |
| `Doppelklick` auf Node | Label inline bearbeiten |
| `Doppelklick` auf Waypoint | Waypoint entfernen |
