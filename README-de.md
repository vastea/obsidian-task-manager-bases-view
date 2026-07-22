# Task Manager Bases View

[English](./README.md) · [简体中文](./README-zh.md)

Ein leichtgewichtiges Aufgabenverwaltungs-Plugin für **Obsidian [Bases](https://help.obsidian.md/bases)**. Es *rendert* ausschließlich — deine Aufgabendaten bleiben im Markdown-Frontmatter oder Notiztext, und **Gruppierung, Filterung und Sortierung übernimmt Bases**. Das Plugin besitzt kein eigenes Datenmodell und verwendet keine fest vorgegebenen Feldnamen. Alle Ansichten tragen das Präfix `tm-`.

> Erfordert **Obsidian 1.10.2+** (Bases-Ansichts-API). Nur Desktop.

## Ansichten

| Ansicht | Typ | Funktion |
|---------|-----|----------|
| **tm-kanban** | Bases-Ansicht | Spalten aus einer Bases-Gruppierung (oder vordefinierte Spalten), Karten per Drag-and-drop verschieben, über das Kontextmenü verschieben oder archivieren. |
| **tm-timeline** | Bases-Ansicht | Gantt-ähnliche Balken und Meilensteine aus Start-/Enddatum-Eigenschaften, per Drag-and-drop umplanbar, gruppierte oder flache Bahnen. |
| **tm-calendar** | Blattansicht | Wochenraster für Zeitblöcke aus Tagesnotizen; durch Ziehen erstellen, über das Kontextmenü bearbeiten oder löschen. |

Das Plugin ist eine dünne Darstellungsschicht: Frontmatter, Bases-Konfiguration oder Drag-and-drop ändern → Bases fragt neu ab → die Ansicht wird neu gerendert. Eine Abfragereferenz wird nie dauerhaft gespeichert.

## Funktionen

### Kanban (`tm-kanban`)

- **Gruppierung vollständig durch Bases.** Die Spalten stammen aus **Gruppieren nach** in Bases. Filter und Sortierung kommen ebenfalls von Bases.
- **Vordefinierte Spalten** (Ansichtsoption): Werte in der gewünschten Reihenfolge, jeweils optional mit Farbe — zum Beispiel `todo|#6b7280` oder `doing|blue`. Die Werte werden mit den Bases-Gruppierungsschlüsseln abgeglichen; nicht zugeordnete oder leere Gruppen landen in der eingeklappten Spalte **Nicht kategorisiert**.
- **Erledigt-Spalten:** `doneStatuses` markiert Spaltenwerte als erledigt. Diese Spalten erhalten eine Schaltfläche zum gemeinsamen Archivieren aller Karten.
- **Drag-and-drop** zwischen Spalten schreibt die Gruppierungseigenschaft neu (nur schreibbare `note.*`-Eigenschaften). Ein Klick öffnet die Notiz in einer wiederverwendeten rechten Teilansicht; Mod-Klick öffnet einen neuen Tab. Ziehen löst keinen Klick aus.
- **Kontextmenü** einer Karte → in eine beliebige Spalte verschieben oder **Archivieren** (schreibt den konfigurierten Archivwert).
- **Änderungsprotokoll aufzeichnen** (Ansichtsoption, standardmäßig aus): Beim Verschieben wird unter einer konfigurierbaren Überschrift (**Überschrift des Änderungsprotokolls**, Standard `Changelog`) ein Eintrag im Format `- yyyy-MM-dd alt->neu` ergänzt. Die Überschrift wird bei Bedarf angelegt; unveränderte Werte erzeugen keinen Eintrag.
- Plane-ähnliche Spalten: volle Höhe, Titel und Anzahl links, Hinzufügen/Einklappen rechts, eingeklappte vertikale Leiste, dezente Spaltenfarbe und eine Schaltfläche für neue Elemente im Inhaltsfluss.

![Kanban mit vordefinierten, dezent eingefärbten Spalten für Backlog, Todo, In Progress, Blocked, Done und Cancelled; Karteneigenschaften erscheinen unter einer Trennlinie, und die Done-Spalte bietet eine Aktion zum gemeinsamen Archivieren](docs/images/kanban-2.png)

### Timeline (`tm-timeline`)

- **Start-/Enddatum-Eigenschaften** werden in den Ansichtsoptionen gewählt; `scale` unterstützt Tag, Woche, Monat, Quartal und Jahr.
- **Bahnen folgen der Bases-Gruppierung** (eine Bahn pro Gruppe); ohne Gruppierung wird eine flache Liste angezeigt.
- Start und Ende ergeben einen Balken, nur ein Enddatum einen **Meilenstein**, fehlende Daten nur eine Beschriftung.
- **Mehrstufige Kopfzeile** — kumulativ von Jahr → Quartal → Monat → Woche → Tag, mit der gröbsten Ebene oben. Jede Zelle zeigt nur ihre eigene Einheit, die Rasterlinien folgen der feinsten Ebene.
- **Abstand** bestimmt den sichtbaren Zeitraum: `default` (unverändert), `moderate` (eine ganze Skaleneinheit an beiden Seiten) oder `fit` (auf ganze Einheiten um die Einträge zuschneiden). Teilzellen am Rand werden so weit verbreitert, dass ihre Beschriftung lesbar bleibt.
- **Zoom** bestimmt unabhängig davon die Darstellungsdichte. **Automatischer Zoom** leitet sie aus der Breite der Ansicht ab, sodass der gesamte Zeitraum ohne horizontales Scrollen passt. Ist er deaktiviert, stellt ein Regler die Dichte relativ zum Standard der Skala ein.
- **Maximale Zellenzahl** begrenzt die Kopfzeile (Standard 120, Minimum 48). Bei größeren Zeiträumen wird das Fenster mit den meisten vollständig enthaltenen Einträgen gezeigt; außerhalb liegende Elemente werden am Rand mit Warnung, Pfeil und echtem Datum im Tooltip markiert. Eine einzelne Timeline kann die Grenze in ihren Ansichtsoptionen ignorieren.
- **Drag-and-drop:** Den Balken verschieben, um beide Daten zu ändern; an einer Kante ziehen, um nur Start oder Ende zu ändern (Rückschreiben nur in `note.*`). Mit aktiviertem **Am Raster ausrichten** rasten Änderungen an der aktuellen Skaleneinheit ein.
- **Farben** (Ansichtsoptionen): drei unabhängige Regel-Listen — **Farbregeln** (Balkenfüllung), **Textfarb-Regeln** (Label-Farbe) und **Textregeln** (Label-Stil). Jede Zeile ist entweder `property|wert|ausgabe` (greift, wenn die Notiz-Eigenschaft dem Wert entspricht; case-insensitive, Listen-Zugehörigkeit) oder nur eine `property` (der eigene Wert dieser Eigenschaft der Notiz ist die Ausgabe). Regeln werden von oben nach unten gelesen, **der erste Treffer gewinnt** pro Liste. Farb-/Textfarb-Ausgabe ist ein Farbname, Hex oder `rgb(...)` (oder `none` für den Standard); Text-Ausgabe ist eine beliebige Kombination aus `strike underline bold italic`, per Leerzeichen getrennt (oder `none` für normalen Text). Beispiel — Balken erledigter Aufgaben grau und durchgestrichen: `status|closed|gray` in den Farbregeln, `status|closed|strike` in den Textregeln.

![Nach Bases-Gruppen aufgeteilte Timeline mit Alpha-, Beta-, Gamma- und Personal-Bahnen, Gantt-Balken und orangefarbenen Meilensteinen; ungruppierte Ansichten erscheinen als flache Liste](docs/images/timeline-2.png)

### Wochenprotokoll-Kalender (`tm-calendar`)

- Ein 7-Tage-Zeitraster aus deinen **Tagesnotizen**. Die einzige Konvention im Notiztext ist ein konfigurierbarer Abschnitt (Standard `Log`), dessen Listeneinträge Zeitblöcke sind:

  ```markdown
  ## Log
  - 14:00-15:00 (Dev) [[Eine Aufgabe]] Notizen
  - 16:00-16:30
  ```

  Format: `HH:MM-HH:MM` → optional `(Kategorie)` → optional `[[Wikilink]]` → optionale Notiz.
- **Überlappende Blöcke** werden nebeneinander angezeigt. Ziehe auf einer freien Rasterfläche nach oben oder unten, um über einen Dialog einen Block zu erstellen. Start- und Endzeit bleiben im Dialog editierbar; außerdem stehen Beschreibung, optionaler Aufgabenlink und Kategorie zur Verfügung. Das Kontextmenü bearbeitet oder löscht einen Block. Ein Klick öffnet die Tagesnotiz an der Protokollzeile.
- **Aktuelle-Zeit-Markierung:** Eine Linie durchquert die heutige Spalte und wird jede Minute aktualisiert. Sie bleibt verborgen, wenn die Woche den heutigen Tag nicht enthält oder die aktuelle Zeit außerhalb des sichtbaren Fensters liegt.
- **Zu Datum springen:** Ein Klick auf den Titel der Werkzeugleiste öffnet eine Datumsauswahl und springt zur passenden Woche; der konfigurierte Wochenanfang wird berücksichtigt.
- **Kategorien und Farben:** Optional in den Einstellungen aktivierbar. Definiere `name|farbe` mit Farbnamen, Hex- oder `rgb(...)`-Wert oder schreibe die Farbe direkt in eine Protokollzeile, zum Beispiel `(Dev|blue)`.
- **Rückverweis** (optional): Verknüpft ein Zeitblock eine Aufgabe, wird unter einer Überschrift in der Aufgabennotiz ein datierter Eintrag ergänzt und bei Änderungen synchron gehalten.
- **Eigenes Tagesfenster:** Standardmäßig `00:00–24:00`; ein engeres Fenster wie `09:00–18:00` konzentriert die Ansicht auf Arbeitszeiten und verteilt die sichtbaren Stunden über die verfügbare Höhe.

![Wochenprotokoll-Kalender für 09:00–17:00 mit farbcodierten Kategorien wie Meeting, Dev, Writing, Review, Admin und Break; überlappende Blöcke werden nebeneinander dargestellt](docs/images/calendar-1.png)

### Sonstiges

- **Aufgabe anklicken → rechte Teilansicht.** Kanban- und Timeline-Einträge öffnen die Notiz in einer wiederverwendeten Detailansicht rechts. Es gibt keine eigene Detailansicht — die Notiz selbst ist das Detail.
- **Internationalisierung:** English / 中文 / Deutsch, in den Einstellungen umschaltbar; Texte in geöffneten Ansichten aktualisieren sich unmittelbar.

## Installation

### Manuell

1. Lade `main.js`, `manifest.json` und `styles.css` aus einem Release herunter (oder baue sie wie unten beschrieben).
2. Kopiere die Dateien nach `<Vault>/.obsidian/plugins/task-manager-bases-view/`.
3. Lade Obsidian neu und aktiviere das Plugin unter **Einstellungen → Community-Plugins**.

### Aus dem Quellcode bauen

```bash
npm install
npm run dev      # Beobachtungsmodus → main.js
npm run build    # Svelte-Typprüfung + Produktions-Bundle
```

`main.js`, `manifest.json` und `styles.css` liegen anschließend im Projektstamm.

## Verwendung

1. Erstelle eine Bases-Datei (`.base`) für deine Aufgabennotizen.
2. Füge eine **tm-kanban**- oder **tm-timeline**-Ansicht hinzu und konfiguriere sie über die Bases-Werkzeugleiste:
   - Kanban: **Gruppieren nach** festlegen (zum Beispiel `status`); optional **Vordefinierte Spalten verwenden** aktivieren und Werte, Farben, Erledigt-Status sowie Archivwert eintragen.
   - Timeline: Start-/Enddatum-Eigenschaften und Skala auswählen.
3. Der Kalender speichert Einträge in Tagesnotizen und benötigt deshalb das aktivierte Kern-Plugin **Tagesnotizen** (Einstellungen → Kern-Plugins → Tagesnotizen). Führe den Befehl **Wochenprotokoll öffnen** aus oder klicke auf das Uhrsymbol im Ribbon.
4. Globale Konventionen wie Wochenanfang, Tagesfenster, Protokollabschnitt, Kategorien, Rückverweise und Timeline-Raster liegen unter **Einstellungen → Task Manager Bases View**. Ordner, Dateinamenformat und Vorlage der Tagesnotizen stammen direkt aus dem Kern-Plugin **Tagesnotizen**.

> Das Ein- oder Ausschalten einer Bases-Ansicht wird erst wirksam, nachdem du das Plugin deaktiviert und erneut aktiviert (oder Obsidian neu gestartet) hast. Die Bases-API bietet keine Möglichkeit, eine einzelne Ansicht wieder abzumelden. Der Kalenderbefehl und das Ribbon-Symbol werden dagegen sofort aktualisiert.

Jede Ansicht kann unabhängig aktiviert werden. Kalender- und Timeline-Einstellungen werden nur angezeigt, solange die jeweilige Ansicht aktiv ist:

![Einstellungen für den Wochenprotokoll-Kalender mit Wochenanfang, Tagesfenster, Protokollüberschrift, optionalen Rückverweisen und farbcodierten Kategorien](docs/images/settings-4.png)

## Referenz der Ansichtsoptionen

| Ansicht | Option | Bedeutung |
|---------|--------|-----------|
| Kanban | `usePredefinedColumns` | Geordnete, farbige vordefinierte Spalten anstelle der rohen Bases-Gruppen verwenden. |
| Kanban | `predefinedValues` | Zeilen im Format `wert` oder `wert\|farbe`; Abgleich mit den Gruppierungsschlüsseln. |
| Kanban | `doneStatuses` | Spaltenwerte, die als erledigt gelten und die gemeinsame Archivaktion erhalten. |
| Kanban | `archiveValue` | Wert, den Archivieren oder gemeinsames Archivieren schreibt. |
| Timeline | `startProp` / `endProp` | Datumseigenschaften für die beiden Balkenenden. |
| Timeline | `scale` | Rastereinheit der Kopfzeile: `day` / `week` / `month` / `quarter` / `year`. |
| Timeline | `rangePadding` | Freier Zeitraum um Einträge: `default` / `moderate` / `fit`. |
| Timeline | `autoZoom` | Dichte aus der Ansichtsbreite ableiten, damit der Zeitraum vollständig passt. |
| Timeline | `zoom` | Dichte als Prozentwert des Skalenstandards (10–200; 100 ist der Standard). |
| Timeline | `ignoreMaxUnits` | Den vollständigen Zeitraum unabhängig von der globalen maximalen Zellenzahl zeichnen. |

## Beispiel-Vault

Ein separates, direkt nutzbares Beispiel liegt im Repository **[obsidian-task-manager-example-vault](https://github.com/vastea/obsidian-task-manager-example-vault)**. Es enthält einen Mehrprojekt-Datensatz, mehrere `.base`-Dateien (gruppiertes Board, vordefinierte Farb-Pipeline, projektbezogene Boards über Filter, flache und gruppierte Timelines sowie Archivierungsablauf) und Tagesnotizen für den Kalender.

## Entwicklung

- **Svelte 5** und esbuild. Einstiegspunkt `src/main.ts` → `main.js` im Projektstamm (CJS, einzelne Datei).
- `src/shared/` enthält den gemeinsamen Kern der drei Ansichten: Zugriff auf Einträge, Frontmatter-Rückschreiben, Wertdarstellung, Abschnittsparser, Detailöffnung, Farbpalette und Internationalisierung.
- Keine Telemetrie und keine Netzwerkanfragen; alles läuft lokal.

## Feedback und Probleme

Fehler gefunden, eine raue Kante entdeckt oder eine Idee? **[Eröffne gern ein Issue](https://github.com/vastea/obsidian-task-manager-bases-view/issues)** — Fehlerberichte, Funktionswünsche und Fragen sind willkommen. Ein Screenshot und deine Obsidian-Version helfen sehr. Änderungen stehen im [Changelog](./CHANGELOG.md).

## Lizenz

[MIT](./LICENSE) © vastea
