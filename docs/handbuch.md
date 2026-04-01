# Benutzerhandbuch – CMK BI Visual Editor

## Inhalt
1. [Starten](#1-starten)
2. [Anmeldung & Benutzerverwaltung](#2-anmeldung--benutzerverwaltung)
3. [Oberfläche](#3-oberfläche)
4. [Node-Typen](#4-node-typen)
5. [Nodes erstellen & bearbeiten](#5-nodes-erstellen--bearbeiten)
6. [Kanten (Verbindungen)](#6-kanten-verbindungen)
7. [Ports](#7-ports)
8. [Auswahl & Multi-Select](#8-auswahl--multi-select)
9. [Layers](#9-layers)
10. [Auto-Layout](#10-auto-layout)
11. [Zoom & Navigation](#11-zoom--navigation)
12. [Speichern & Export](#12-speichern--export)
13. [Checkmk BI Import/Export](#13-checkmk-bi-importexport)
14. [Theme (Dark / Light)](#14-theme-dark--light)
15. [Audit-Log](#15-audit-log)
16. [Tastenkürzel](#16-tastenkürzel)

---

## 1 Starten

### Option A – Statischer Webserver (nur Frontend)
```sh
cd src/
python3 -m http.server 8000
```
Browser: `http://localhost:8000`

### Option B – Mit FastAPI-Backend (Save / Validate / Audit)
```sh
cd src/
pip install fastapi uvicorn
uvicorn main:app --reload --port 8000
```

### Option C – Docker (empfohlen)
```sh
docker compose up --build
```
Browser: `http://localhost:80`

---

## 2 Anmeldung & Benutzerverwaltung

### Auth aktivieren

Standardmäßig ist `AUTH_ENABLED=false` — die App läuft ohne Login (alle Benutzer sind anonymous-Admins, nützlich für Entwicklung/Test).

Um Auth zu aktivieren, in `.env` setzen:
```
AUTH_ENABLED=true
```
Beim ersten Start wird automatisch ein Benutzer **`admin` / `admin`** angelegt — sofort in der Benutzerverwaltung ändern!

### Login

Wenn Auth aktiviert ist, erscheint beim Start das Login-Modal:

1. **Anmeldung via** — Methode wählen (Lokaler Benutzer / LDAP / Checkmk), sofern mehrere konfiguriert
2. Benutzername und Passwort eingeben
3. **Anmelden** klicken

Das Token ist 8 Stunden gültig. Nach Ablauf erscheint automatisch das Login-Modal.

### Auth-Kette

Das Backend versucht die Anmeldung in dieser Reihenfolge:
1. **Lokale Benutzer** (data/users.json)
2. **LDAP / Active Directory** (wenn `LDAP_URL` konfiguriert)
3. **Checkmk** (wenn `CMK_URL` konfiguriert)

LDAP- und Checkmk-Benutzer werden automatisch in der lokalen DB gespeichert (ohne Passwort).

### LDAP konfigurieren

```env
LDAP_URL=ldap://dc.example.com:389
LDAP_BIND_DN=cn=serviceaccount,ou=users,dc=example,dc=com
LDAP_BIND_PASSWORD=geheim
LDAP_USER_BASE=ou=users,dc=example,dc=com
LDAP_USER_FILTER=(sAMAccountName={username})
LDAP_ADMIN_GROUP=cn=bi-admins,ou=groups,dc=example,dc=com
```

### Checkmk-Auth konfigurieren

```env
CMK_URL=https://checkmk-server/site
```

Benutzer werden per Basic-Auth am Checkmk REST-API verifiziert. Admin-Rolle wird aus dem CMK-Benutzerprofil gelesen.

### Benutzerverwaltung (Admin)

Toolbar → **Shield-Button** (nur für Admins sichtbar).

Das Admin-Modal zeigt alle Benutzer in einer Tabelle:

| Spalte | Beschreibung |
|---|---|
| Benutzer | Username und E-Mail |
| Rolle | Admin / User |
| Typ | local / ldap / checkmk |
| Letzter Login | Zeitstempel |
| Status | Aktiv / Deaktiviert |
| Aktionen | Toggle, Bearbeiten, Löschen |

**Aktionen:**

| Button | Beschreibung |
|---|---|
| Toggle-Icon | Benutzer aktivieren / deaktivieren |
| Stift-Icon | Benutzer bearbeiten (Rolle, E-Mail, Passwort) |
| Papierkorb-Icon | Benutzer löschen (letzter Admin ist geschützt) |
| **Neuer Benutzer** | Formular zum Anlegen |

### Abmelden

Toolbar → **Logout-Button** (Türpfeil-Icon, nur sichtbar wenn eingeloggt).

---

## 3 Oberfläche

```
┌──────────────────────────────────────────────────────────────────┐
│  Undo Redo │ Speichern Validieren │ ↑JSON ↓JSON │ 📦↑ 📦↓       │
│  Layout ▾  │ ⊞Snap │ Preview │ Audit │ ☀ Theme │ Benutzer │ Zoom │
├───────────┬──────────────────────────────────┬───────────────────┤
│ Palette   │                                  │  Inspector        │
│           │         Canvas                   │  (Eigenschaften   │
│ Aggreg.   │  (Nodes & Kanten)                │   der Auswahl)    │
│ Host      │                                  │                   │
│ Service   │                                  │                   │
│ Host-Grp. │                                  ├───────────────────┤
│ Svc.-Grp. │                                  │  Search           │
│ Andere BI ├──────────────────────────────────┤                   │
│ ───────── │                                  │                   │
│ Layers    │                                  │                   │
└───────────┴──────────────────────────────────┴───────────────────┘
```

**Palette** (links): Ziehbare Node-Typen + Layer-Verwaltung.  
**Canvas** (Mitte): Arbeitsfläche, endlos scrollbar und zoombar.  
**Inspector** (rechts): Eigenschaften des ausgewählten Elements.

**Toolbar-Buttons (von links):**

| Symbol | Funktion |
|---|---|
| Undo / Redo | Letzte Aktion rückgängig / wiederholen |
| Speichern | Graph sichern (Backend oder localStorage) |
| Validieren | Zyklen-Prüfung |
| ↑ (Upload) | Internes JSON importieren |
| ↓ (Download) | Internes JSON exportieren |
| 📦↑ (grün) | **Checkmk BI Pack importieren** |
| 📦↓ (grün) | **Als Checkmk BI Pack exportieren** |
| Layout ▾ | Auto-Layout ausführen / Modus wählen |
| ⊞ | Grid-Snap ein/aus |
| Preview | Node-Zustände simulieren |
| Audit | Audit-Log öffnen |
| ☀ / 🌙 | Theme wechseln |
| Shield (grün) | **Benutzerverwaltung** (nur Admins) |
| Benutzer | Aktuell eingeloggter Benutzer (Name + ⚙ = Admin) |
| Türpfeil | **Abmelden** (nur sichtbar wenn Auth aktiv) |
| − 100% + | Zoom |

---

## 3 Node-Typen

| Typ | Farbe | Zweck | CMK-Entsprechung |
|---|---|---|---|
| **BI Aggregator** | Grün `#13d38e` | Sammelt Kind-Zustände per Aggregationsfunktion | `call_a_rule` |
| **Host** | Hellgrün `#A5D6A7` | Einzelner Host | `state_of_host` |
| **Service** | Blaugrau `#90A4AE` | Einzelner Service | `state_of_service` |
| **Host-Gruppe** | Grün `#66BB6A` | Regex-basierte Host-Auswahl | `host_search` |
| **Service-Gruppe** | Graublau `#78909C` | Regex-basierte Service-Auswahl | `service_search` |
| **Andere BI** | Lila `#9C7DFF` | Verweis auf ein anderes BI-Aggregat | `call_a_rule` |

**Kantenrichtung:** Der Pfeil zeigt vom Kind (Status-Quelle) zum Aggregator (Status-Senke). Das entspricht dem Checkmk-BI-Datenfluss.

---

## 4 Nodes erstellen & bearbeiten

### Erstellen per Drag & Drop
1. Element aus der Palette greifen
2. Auf den Canvas ziehen und loslassen

### Label ändern
- **Doppelklick** auf Node → Eingabefeld direkt auf dem Node  
- Enter bestätigt, ESC bricht ab  
- Alternativ: Inspector → Feld „Label"

### Aggregation-Typ (nur BI Aggregator)
Im Inspector → Dropdown „Aggregation-Typ":

| Typ | Bedeutung | CMK-Export |
|---|---|---|
| AND | Alle müssen OK sein | `worst` |
| OR | Mindestens einer OK | `best` |
| Best state | Bester Zustand zählt | `best` |
| Worst state | Schlechtester Zustand zählt | `worst` |
| Best of N | N Nodes müssen OK sein | `count_ok` |
| Worst of N | Schlechtester von N | `worst (count=N)` |

### Host / Service zuweisen
Inspector → Feld „Host" / „Service" / „Host-Gruppe" etc. — mit Autocomplete-Vorschlägen.

### BI-Verweis (nur Andere BI)
Inspector → Feld „Verweis auf BI" — der Name wird als `↗ name` direkt auf dem Node angezeigt.

### Farbe ändern
Inspector → Farb-Picker. Die Farbe gilt auch für abgehende Kanten.

### Verschieben
Node anklicken und ziehen. Bei Multi-Select bewegen sich alle markierten Nodes gemeinsam. Nodes in gesperrten Layers können nicht verschoben werden.

### Löschen
- Node auswählen → `Entf` oder `Backspace`
- Rechtsklick → **Löschen**
- Inspector → „Node löschen"

### Duplizieren
Rechtsklick → **Duplizieren** — neuer Node erscheint 40 px versetzt.

---

## 5 Kanten (Verbindungen)

### Verbindung erstellen
**Methode A – Connect-Modus:**
1. Node auswählen → Inspector → **„Mit anderem Knoten verbinden →"**  
   *oder* Rechtsklick → **Verbinden mit…**
2. Canvas wechselt in Connect-Modus (grüner Tooltip unten)
3. Ziel-Node oder Ziel-Port anklicken
4. `Rechtsklick` oder `ESC` bricht ab

**Methode B – Port-Drag** (siehe [Abschnitt 6](#6-ports))

### Routing-Stil
Im Inspector → „Linientyp":

| Stil | Verhalten |
|---|---|
| Gerade (Standard) | Orthogonale Linie mit gerundeten Ecken an Waypoints |
| Bézier | Geschwungene Kurve, weicht Nodes aus |

### Pfeilstil & Pfeilgröße
Inspector → „Pfeil": Keiner (—), Chevron (▶), Thin (›), Dot (●)  
Inspector → „Pfeilgröße" (nur wenn Pfeil ≠ Keiner): Kl / Mi / Gr

### Waypoints (Knicke)
1. Kante auswählen → Handles erscheinen
2. Gestrichelten Midpoint-Handle ziehen → fügt Waypoint ein
3. Gefüllten Waypoint-Handle (großer Kreis) ziehen → verschiebt
4. Doppelklick auf Waypoint → entfernt ihn

### Kante löschen
Kante auswählen → `Entf` — oder Inspector → „Verbindung löschen"

### Richtung umkehren
Rechtsklick auf Kante → **Richtung umkehren**

---

## 6 Ports

Jeder Node hat 4 unsichtbare Port-Dots (oben/rechts/unten/links), die bei Node-Hover oder im Connect-Modus sichtbar werden.

**Port-Drag:**
1. Maus auf Port-Dot (kleiner grüner Kreis) → Cursor wird zum Kreuz
2. Maustaste gedrückt halten und zu einem anderen Node/Port ziehen
3. Loslassen → Kante wird mit `fromPort` / `toPort` erstellt

Ports ermöglichen präzise Kantenpositionierung, besonders bei engem Layout.

---

## 7 Auswahl & Multi-Select

| Aktion | Ergebnis |
|---|---|
| Klick auf Node/Kante | Einzelauswahl |
| Shift + Klick | Element hinzufügen / entfernen |
| Lasso (Drag auf freier Fläche) | Alle Nodes im Rechteck |
| ESC | Auswahl aufheben |

### Ausrichten (≥ 2 Nodes markiert)
Im Inspector erscheint das Ausrichten-Panel:

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

## 8 Layers

Layer ermöglichen das Gruppieren von Nodes zur besseren Übersicht.

**Layers-Panel** (links unten in der Sidebar):

| Aktion | Beschreibung |
|---|---|
| **+** Button | Neuen Layer anlegen (Name per Prompt) |
| Auge-Icon | Layer ein-/ausblenden |
| Schloss-Icon | Layer sperren — Nodes nicht verschiebbar |
| Hover-Button | Layer löschen (Nodes bleiben erhalten) |

**Node einem Layer zuweisen:**  
Inspector → Dropdown „Layer" → Layer auswählen.

Ausgeblendete Nodes werden im Canvas nicht angezeigt und nicht exportiert.

---

## 9 Auto-Layout

| Klick | Verhalten |
|---|---|
| Haupt-Button | Wechselt TD ↔ LR und führt Layout aus |
| Chevron ▾ | Dropdown mit allen Modi |

| Modus | Beschreibung |
|---|---|
| ↓ TD (Top → Bottom) | Hierarchie von oben nach unten |
| → LR (Left → Right) | Hierarchie von links nach rechts |
| ⊞ Am Raster ausrichten | Alle Nodes auf 20 px-Raster snappen |

Der Algorithmus (Sugiyama-inspiriert) erkennt automatisch:
- Topologische Schichten (Longest-Path-Ranking)
- Kreuzungsminimierung (Barycenter-Heuristik, 2 Durchläufe)
- Skip-Layer-Bypass (Kanten überspringen Schichten, routing außerhalb)

**Hinweis:** Layout überschreibt manuelle Positionen — `Ctrl+Z` macht es rückgängig.

---

## 10 Zoom & Navigation

| Aktion | Beschreibung |
|---|---|
| Scroll-Rad | Zoom zur Mausposition |
| Toolbar `+` / `−` | Zoom in / out |
| Mittelklick + Drag | Canvas verschieben |
| Rechtsklick + Drag | Canvas verschieben |

Zoom-Bereich: 25 % – 400 %

---

## 11 Speichern & Export

| Button | Funktion |
|---|---|
| **Speichern** | POST an `/save` (Backend), Fallback: localStorage |
| **Validieren** | Zyklen-Prüfung per Kahn's Algorithm |
| **↑ Import** | Internes JSON laden (ersetzt aktuellen Graph) |
| **↓ Export** | Internes JSON herunterladen |

### Internes JSON-Format
```json
{
  "nodes": [
    {
      "id": 1, "type": "aggregator", "label": "Frontend",
      "x": 320, "y": 280, "color": "#13d38e",
      "icon": "git-merge", "aggType": "best"
    },
    {
      "id": 2, "type": "host", "label": "web-prod-01",
      "x": 120, "y": 120, "color": "#A5D6A7",
      "icon": "server", "meta": { "hostSvc": "web-prod-01" }
    }
  ],
  "edges": [
    {
      "id": "e1", "from": 2, "to": 1,
      "routing": "straight", "arrowStyle": "chevron", "arrowSize": "sm"
    }
  ]
}
```

---

## 12 Checkmk BI Import/Export

Die grün umrandeten Buttons in der Toolbar ermöglichen den direkten Austausch mit Checkmk.

### Export → Checkmk

1. Toolbar → **📦↓ (CMK-Export)**
2. Pack-ID eingeben (z. B. `meine_applikation`)
3. Pack-Titel eingeben
4. Download `<packid>_bi_pack.json`

Die Datei kann direkt in Checkmk über **Setup → Business Intelligence → Import** geladen werden.

**Was wird exportiert:**

| ui-4-bi Node | CMK BI Aktion |
|---|---|
| BI Aggregator | `call_a_rule` (erzeugt Regel + ggf. Aggregation) |
| Host | `state_of_host` |
| Service | `state_of_service` |
| Host-Gruppe | `host_search` mit Regex-Pattern |
| Service-Gruppe | `service_search` |
| Andere BI | `call_a_rule` (verweist auf externe Regel) |

Root-Aggregatoren (kein ausgehender Pfeil) erzeugen automatisch einen `aggregations`-Eintrag.

### Import ← Checkmk

1. Toolbar → **📦↑ (CMK-Import)**
2. Checkmk BI Pack JSON auswählen (z. B. aus CMK-Backup oder REST-API)
3. Graph wird geladen und automatisch per Auto-Layout (TD) angeordnet

**Unterstützte CMK-Strukturen:**
- `state_of_host` → Host-Node
- `state_of_service` → Service-Node
- `state_of_remaining_services` → Service-Node mit Bezeichnung *(remaining)*
- `host_search` → Host-Gruppen-Node
- `service_search` → Service-Gruppen-Node
- `call_a_rule` → Aggregator-Node oder Andere-BI-Node

### Checkmk REST-API (manuell)

Pack direkt aus Checkmk holen:
```sh
curl -u automation:SECRET \
  https://checkmk-server/site/check_mk/api/1.0/objects/bi_pack/default \
  -o default_bi_pack.json
```

Pack zurück nach Checkmk schieben:
```sh
curl -X PUT -u automation:SECRET \
  -H "Content-Type: application/json" \
  https://checkmk-server/site/check_mk/api/1.0/objects/bi_pack/ui4bi \
  -d @ui4bi_bi_pack.json
```

---

## 13 Theme (Dark / Light)

Toolbar → **☀ / 🌙**-Button schaltet zwischen Dark und Light Mode um.  
Die Einstellung wird in `localStorage` gespeichert und beim nächsten Start wiederhergestellt.

---

## 14 Audit-Log

Jede Änderung wird automatisch protokolliert (Zeitstempel, Benutzer, Aktion, Details).

**Öffnen:** Toolbar → **Audit**-Button (Uhr-Icon)

| Funktion | Beschreibung |
|---|---|
| Suche | Freitext-Filter über alle Felder |
| Aktions-Filter | Nur bestimmte Aktions-Typen anzeigen |
| CSV-Export | Gefilterte Einträge herunterladen |

Der Benutzername im Audit-Log entspricht dem angemeldeten Benutzer (oder `anonymous` wenn Auth deaktiviert).

---

## 15 Tastenkürzel

| Shortcut | Aktion |
|---|---|
| `Ctrl + Z` | Rückgängig |
| `Ctrl + Y` | Wiederholen |
| `Ctrl + S` | Speichern |
| `Entf` / `Backspace` | Ausgewähltes löschen |
| `ESC` | Connect-Modus beenden / Auswahl aufheben |
| `Shift + Klick` | Multi-Select: Element hinzufügen/entfernen |
| `Doppelklick` auf Node | Label inline bearbeiten |
| `Doppelklick` auf Waypoint | Waypoint entfernen |
| Scroll-Rad | Zoom zur Mausposition |
| Mittelklick + Drag | Canvas verschieben |
| Rechtsklick auf Canvas | Connect-Modus abbrechen |
