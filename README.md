# Planungstool Läng

Prototyp im Praxisprojekt FHNW HS 26 für die Läng Schreinerei und Küchenbau AG.
Zeigt Verfügbarkeit und Auslastung von Produktion, Montage und Maschinen auf Stundenbasis und macht Engpässe sichtbar.

Technik: React, TypeScript, Vite, Tests mit Vitest. Läuft lokal im Browser, ohne Server und ohne Internet.

## Start

Voraussetzung: Node.js (ab Version 20).

```bash
npm install
npm run dev
```

Danach im Browser http://localhost:5173 öffnen. Die mitgelieferten Testdaten sind sofort geladen.

Offline-Version als einzelne Datei erzeugen:

```bash
npm run build
```

Die Datei `dist/index.html` lässt sich direkt im Browser öffnen (Doppelklick), ohne Server.

Tests:

```bash
npm test
```

## Testdaten erzeugen

```bash
npm run testdaten
```

Erzeugt im Ordner `testdata/` die Dateien `auftraege.csv`, `mitarbeitende.csv`, `absenzen.csv` und `maschinen.csv`
mit Seed 42 und Stichtag 2026-11-23. Gleicher Seed ergibt gleiche Dateien. Anderer Seed oder Stichtag:

```bash
npx tsx testdata/generator.ts --seed 7 --stichtag 2027-01-04
```

Annahmen in den Testdaten: Feiertage Kanton Bern und Betriebsferien 24.12.2026 bis 03.01.2027 (Testannahme),
rund 1'100 Projekte pro Jahr, Mix der Projektarten gemäss Kick-off, einige Ferien, Krankheitstage und Weiterbildungen je Person.
Personen nur als Kürzel MA01 bis MA27.

## Import

In der App unten im Bereich "Import" eine oder mehrere CSV-Dateien wählen. Die Datenart wird an der Kopfzeile erkannt.
Fehlerhafte Zeilen werden mit Zeilennummer und Grund angezeigt und nicht übernommen.
Eine importierte Datei ersetzt die Daten dieser Art nur für die laufende Sitzung. Das Tool speichert nichts und schreibt nichts nach Triviso.

Format: UTF-8, Semikolon als Trenner, Datum JJJJ-MM-TT, Dezimalzeichen Punkt oder Komma.

| Datei | Spalten |
|---|---|
| Aufträge | auftrag_nr; position; bezeichnung; projektart; status; bereich; termin; dauer_tage; einsatz_std |
| Mitarbeitende | ma_id; name; pensum; std_mo; std_di; std_mi; std_do; std_fr; anteil_produktion; anteil_montage; lernend; lehrjahr |
| Absenzen | absenz_id; ma_id; von; bis; stunden_pro_tag; art |
| Maschinen | maschine_id; bezeichnung; maschinengruppe; kapazitaet_tag; personalbedarf_tag |

Aufträge: eine Zeile pro Position und Bereich, wie im Triviso-Bericht. Bereich "Werkstatt" wird zu Produktion,
"Planung" wird nicht geplant. Anteile der Mitarbeitenden in Prozent.
Absenzen: ma_id leer gilt für alle; ma_id und stunden_pro_tag leer bedeutet Betrieb geschlossen (Feiertag, Betriebsferien);
stunden_pro_tag leer bedeutet ganzer Tag.

Echte Exporte gehören in den Ordner `data/`. Er ist in `.gitignore` und wird nie committet.

## Aufbau

```
config/        Codetabellen, Spaltenzuordnung Triviso, Startwerte der Parameter
src/import/    Leser je Datenart, Feldzuordnung, Prüfung
src/model/     Typen des Datenmodells, Laden der Konfiguration
src/calc/      verfügbar, Bedarf, Verteilung, Auslastung (reine Funktionen mit Tests)
src/ui/        Oberfläche
testdata/      Generator und erzeugte CSV-Dateien
```

## Annahmen für den Prototyp (im Team bzw. mit Läng zu bestätigen)

- Importformat eine Zeile pro Position und Bereich (offener Punkt 3).
- Bedarf aus den Durchschnittswerten der Projektart, `einsatz_std` wird nicht verwendet (offener Punkt 4).
  Umschaltbar in `config/parameter-startwerte.json` mit `bedarf_quelle`. Hat ein Auftrag mehrere Positionen im selben Bereich,
  wird der Durchschnittswert gleichmässig auf diese Positionen verteilt.
- Status 10 Offerte, 20 bestätigt, 30 in Ausführung (offener Punkt 1), in `config/codetabellen.json`.
- Absenzen werden von den Tagesstunden abgezogen, danach wird nach Bereichsanteil aufgeteilt.
