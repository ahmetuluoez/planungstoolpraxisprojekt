# Planungstool Läng (Praxisprojekt FHNW HS 26)

Prototyp für die Läng Schreinerei und Küchenbau AG, Ersigen. Projekt-Nr. 3-26.W-PA-7993/01.
Team: Bedirhan Özsoy, Kinthuyan Satheeswaran, Elian Stein, Erdem Vural.

Ziel: Verfügbarkeit und Auslastung von Personal (Produktion, Montage) und Maschinen auf Stundenbasis zeigen.
Grobplanung 52 Wochen ab Stichtag (in Wochen), Feinplanung 2 Monate ab Stichtag (Stunden pro Tag).
Engpässe sichtbar machen. Grundlage: Anforderungskatalog v1.1 (L2, L3) vom 06.11.2026.

## Arbeitsregeln

- Sprache in Oberfläche, Kommentaren und Doku: Deutsch, Schweizer Rechtschreibung (ss statt ß).
- Keine Gedankenstriche in Texten der Oberfläche und Doku.
- Fachbegriffe und Feldnamen wie im Datenmodell unten (auftrag_nr, projektart usw.).
- Nur ändern, was verlangt ist. Wenn etwas nicht zum Anforderungskatalog passt: nachfragen statt raten.
- Kleine Schritte, nach jedem Schritt lauffähig. Commit mit kurzer deutscher Nachricht.
- Echte Daten von Läng liegen nur im Ordner `data/` und werden nie committet (steht in `.gitignore`).
  Ins Repo kommen nur Testdaten. Personen nur als Kürzel (MA01 bis MA27).

## Technische Leitplanken (aus dem Katalog)

- TA-01: Bausteine Import, Datenmodell, Berechnung, Oberfläche. Zusammenarbeit nur über definierte Funktionen.
- TA-02: Eine Lese-Schnittstelle je Datenart (Aufträge, Mitarbeitende, Absenzen, Maschinen). Heute Dateien, später Triviso.
- TA-03: Berechnung und Oberfläche kennen nur das interne Datenmodell. Zuordnung Triviso-Spalten in einer Konfigurationsdatei.
- TA-05: Liest nur, schreibt nichts nach Triviso.
- TA-06: Keine eigene Datenhaltung. Parameteränderungen gelten nur für die laufende Sitzung.
- TA-07: Import als CSV (UTF-8, Semikolon) oder Excel. Datum JJJJ-MM-TT.
- TA-08: Wertelisten (Status, Projektart, Bereich, Absenzart) in Codetabellen, nicht im Code.
- TA-09: Läuft lokal im Browser, ohne Server, Internet oder Cloud.
- TA-10: Nur kostenlose Software. Technologieentscheid steht in L4. Vorschlag unten, mit L4 abgleichen.
- TA-12: Versioniert, README mit Start, Import und Testdaten.
- NF-09: Triviso bleibt führend. Das Tool führt keinen eigenen Stand zu Aufträgen und Absenzen.

Vorschlag Technik (mit L4 abgleichen): React, TypeScript, Vite. Tests mit Vitest.
Auslieferung als statische Seite, die offline im Browser läuft (z. B. ein einzelnes HTML mit vite-plugin-singlefile).
Excel lesen mit SheetJS. Diagramme mit Recharts oder schlicht mit SVG.

Vorgeschlagene Struktur:

```
config/           codetabellen.json, spalten-triviso.json, parameter-startwerte.json
src/import/       Leser je Datenart, Feldzuordnung, Prüfung (fehlerhafte Zeilen mit Grund)
src/model/        Typen des Datenmodells
src/calc/         reine Funktionen: verfügbar, Bedarf, Verteilung, Auslastung (mit Tests)
src/ui/           Grobplanung, Feinplanung, Auftragsliste, Parameter
testdata/         Generator (Seed) und erzeugte CSV-Dateien
data/             echte Exporte, nicht im Repo
```

## Datenmodell (Kapitel 7 des Katalogs)

Herkunft: T = Triviso (heute Testdaten), E = Excel-Stammdaten, B = vom Tool berechnet.

- **Auftrag (T):** auftrag_nr (PK), bezeichnung, auftragstyp, projektart, status, produktionsstart, montagetermin,
  liefertermin, arbeitsstunden, auftragssumme, projektleitung, zusatzauftrag (Ja/Nein), geaendert_am,
  material_bereit_bis (berechnet).
- **Mitarbeitende (E):** ma_id (PK), name (Kürzel), pensum, std_mo bis std_fr, anteil_produktion, anteil_montage,
  lernend (Ja/Nein), lehrjahr. Das Feld "maschinen" fällt weg (Entscheid Team: der Mensch ist der Engpass,
  nicht die Maschine; keine Zuordnung Person zu Maschine).
- **Absenz (T):** absenz_id (PK), ma_id (leer = alle, z. B. Feiertag, Betriebsferien), von, bis, stunden_pro_tag, art.
- **Arbeitsschritt (E):** code (PK), bezeichnung, bereich, maschinengruppe (optional).
- **Durchschnittswert (E):** projektart + arbeitsschritt (PK), stunden (im Tool änderbar), startwert.
- **Maschine (E):** maschine_id (PK), bezeichnung, maschinengruppe, kapazitaet_tag (änderbar), personalbedarf_tag (änderbar).
- **Belegung (B):** auftrag_nr + arbeitsschritt + datum (PK), stunden, bereich, maschine_id.

### Erkenntnis aus dem Triviso-Bericht "Auslastung Projekte" (Stand 10.11.2026)

Triviso führt pro Auftrag mehrere **Positionen** (z. B. L.220569.01, .03, .04), jede mit eigenem Status.
Pro Position und Bereich (Planung, Werkstatt, Montage) gibt es: Termin (Start), Dauer in Arbeitstagen,
Einsatz in Stunden, Erfasst, Offen. Triviso verteilt den Einsatz gleichmässig über die Dauer.
"Werkstatt" in Triviso entspricht "Produktion" im Tool. "Planung" wird im Tool nicht geplant.

Darum soll das Importformat **eine Zeile pro Position und Bereich** erlauben:
`auftrag_nr; position; bezeichnung; projektart; status; bereich; termin; dauer_tage; einsatz_std`.
Das weicht vom Datenmodell im Katalog ab (dort nur produktionsstart, montagetermin, arbeitsstunden).
Im Code als Konfiguration lösen, nicht fest einbauen. Im Team noch zu bestätigen.

## Berechnung (Kapitel 4)

- FA-05: verfügbar je Tag und Bereich = Tagesstunden der Person (std_mo bis std_fr) × Bereichsanteil − Absenzen.
  Wochenende, Feiertage und Betriebsferien = 0.
  Lernende: der Tag ohne Stunden ist der Berufsschultag. Er ist damit schon abgezogen, nicht nochmals als Absenz abziehen.
- FA-06: Stundenbedarf = Durchschnittswert der Projektart je Arbeitsschritt. Jeder Schritt gehört zu einem Bereich
  und höchstens einer Maschine. Wenn der Import einen Einsatz liefert (einsatz_std), gilt dieser für den Bereich;
  die Aufteilung auf Arbeitsschritte und Maschinen erfolgt anteilig nach den Durchschnittswerten. (Annahme, offen)
- FA-07: Verteilung auf Arbeitstage. Wenn dauer_tage vorhanden: gleichmässig über die Dauer ab Termin (wie Triviso).
  Sonst Montage mit PP-04 (16,6 h pro Tag) ab Montagetermin, Produktion vorerst mit 8,3 h pro Tag ab Produktionsstart
  ("Tage auffüllen"). Verteilregel in genau einer Funktion halten, damit sie leicht änderbar ist.
- FA-08: Auslastung = geplant ÷ verfügbar, je Tag und Woche, für Produktion, Montage und jede Maschine.
- FA-09: material_bereit_bis = Produktionsstart − Materialvorlauf (PP-05, Arbeitstage).
- FA-10: Nach jedem Import und jeder Parameteränderung sofort neu berechnen.
- Ampel: bis 90 % frei, 90 bis 100 % knapp, über 100 % Engpass (Farbe und Symbol, FA-14).
- Offerten zählen nicht zur Auslastung. Sie werden separat dargestellt (schraffiert, ausblendbar, FA-13),
  damit sichtbar ist, wo bei Annahme ein Engpass entstehen würde.
- Aufträge werden im Tool nicht verschoben (nur in Triviso).

## Planungsparameter (Kapitel 8, Startwerte)

| Nr. | Parameter | Startwert |
|---|---|---|
| PP-01 | Durchschnittswerte je Projektart und Arbeitsschritt | Tabelle unten |
| PP-02 | Tageskapazität je Maschine | BC 15 h (je 7,5 h M1 und M2, Annahme), BBS 8 h, KLM 7 h, SPR 7 h, PZ 8 h |
| PP-03 | Personalbedarf je Maschine und Tag | BC 16,6 h (je 8,3 h, Annahme), übrige 8,3 h |
| PP-04 | Montagestunden je Auftrag und Tag | 16,6 h (zwei Monteure) |
| PP-05 | Materialvorlauf vor Produktionsstart | 5 Arbeitstage |
| PP-06 | Warnschwelle Auslastung | 90 % |

Maschinen laufen Montag bis Freitag (Kapazität pro Woche: BC 75, BBS 40, KLM 35, SPR 35, PZ 40).

## Codetabellen (Startwerte)

- Bereich: Produktion, Montage, Vertrieb/Projektleitung (Vertrieb/PL wird nicht geplant, Won't).
- Projektart: Vertrieb und Projektleitung, Allgemeine Schreinerarbeiten, Küchen, Schränke, Türen, Fenster, Service, DL Drittfirma.
- Status (Vermutung aus dem Triviso-Bericht, von Läng noch zu bestätigen):
  10 = Offerte, 20 = Auftrag bestätigt, noch nicht in Arbeit, 30 = in Ausführung.
  Offerten erscheinen im Bericht nicht, sie müssen über den Export kommen.
- Absenzart: Ferien, Krankheit, Dienstpflicht, Feiertag, Betriebsferien, Weiterbildung, Sonstiges.
- Auftragsnummern: L.xxxxxx.xx = Kundenprojekt, S.xxxxxx = Serviceprojekt.

## Durchschnittswerte (Ressourcen-Datei, Betriebszeiten 01.01. bis 23.09.2026, Stunden pro Projekt)

Maschine: BC = Bearbeitungscenter, BBS = Breitbandschleifen, KLM = Kantenleimmaschine, SPR = Oberfläche (Spritzraum), PZ = Plattenzuschnitt.
Leere Felder = 0.

```csv
arbeitsschritt;bereich;maschine;Vertrieb und Projektleitung;Allgemeine Schreinerarbeiten;Küchen;Schränke;Türen;Fenster;Service;DL Drittfirma
Arbeitsvorbereitung;Vertrieb/Projektleitung;;2.06;2.37;6.94;2.60;1.78;0.27;0.16;0.09
Ausbildung;Vertrieb/Projektleitung;;0.24;0.10;;;;;;
Bankarbeiten;Produktion;;;2.33;10.07;4.83;2.25;7.56;0.20;1.90
Bearbeitungscenter;Produktion;BC;;0.50;4.14;1.80;0.39;0.15;0.02;0.25
Breitbandschleifen;Produktion;BBS;;0.07;0.07;0.14;0.07;0.31;0.00;0.01
Einkauf;Vertrieb/Projektleitung;;0.06;0.03;;0.03;0.17;0.03;0.00;0.00
Fahrzeit;Montage;;0.04;1.18;2.47;0.88;1.20;0.82;0.61;0.81
Furnierzuschnitt;Produktion;;;0.00;;;;;;
Kantenleimmaschine;Produktion;KLM;;0.26;2.80;1.13;0.03;;0.02;0.70
Lieferung;Montage;;0.05;0.38;3.56;1.38;0.13;0.47;0.03;0.03
Material Lager;Produktion;;;;0.00;;;;;
Massivholzzuschnitt;Produktion;;;0.11;;0.03;0.09;;0.00;
Montage;Montage;;0.19;9.58;21.45;5.44;9.08;10.07;1.82;1.44
Oberfläche;Produktion;SPR;0.01;0.59;1.26;0.96;1.29;0.35;0.05;0.08
Planung Produktion;Vertrieb/Projektleitung;;;0.00;0.24;0.02;0.02;0.06;;
Plattenzuschnitt;Produktion;PZ;;0.47;3.19;1.61;0.08;0.01;0.04;0.55
Schlüsseldienst;Montage;;;;;;;;;0.02
Standardmaschinen;Produktion;;;0.51;0.65;0.26;0.26;3.25;0.03;0.04
Unterhalt;Produktion;;;0.01;0.16;;0.00;;;
Vertrieb;Vertrieb/Projektleitung;;2.20;0.24;0.81;0.20;0.36;0.03;0.06;0.03
Verwaltung;Vertrieb/Projektleitung;;0.63;0.15;0.30;0.16;0.09;;0.02;0.01
```

Kontrollsummen je Projektart: 5.48; 18.88; 58.11; 21.47; 17.29; 23.38; 3.06; 5.96.
Küchen nach Bereich: Produktion 22,3 h, Montage 27,5 h (Montage 21,45 + Lieferung 3,56 + Fahrzeit 2,47), Vertrieb/PL 8,3 h.

## Mitarbeitende (Ressourcen-Datei, anonymisiert)

Anteile in Prozent. Nur Produktion und Montage werden geplant. Tagesstunden sind massgebend, nicht das Pensum.
Korrekturen gegenüber der Excel: MA04 und MA05 hatten vertauschte Tageswerte (korrigiert);
MA11 arbeitet 3 Tage (24,9 h), das Pensum "50 %" in der Excel stimmt nicht.

```csv
ma_id;pensum;anteil_produktion;anteil_montage;lernend;std_mo;std_di;std_mi;std_do;std_fr;bemerkung
MA01;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3;GL 30, VPL 55, KD 5, Ausbildung 10
MA02;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3;GL 5, KD 45, Administration 50
MA03;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3;GL 5, VPL 85, KD 5, Ausbildung 5
MA04;100;0;5;Nein;8.3;8.3;8.3;8.3;8.3;GL 5, VPL 80, KD 5, Ausbildung 5
MA05;20;0;0;Nein;0;0;8.3;0;0;KD 10, Administration 30, Assistenz 60
MA06;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3;VPL 95, KD 5
MA07;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3;VPL 95, KD 5
MA08;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3;VPL 95, KD 5
MA09;100;90;0;Nein;8.3;8.3;8.3;8.3;8.3;Ausbildung 10
MA10;100;100;0;Nein;8.3;8.3;8.3;8.3;8.3;
MA11;60;100;0;Nein;0;8.3;8.3;8.3;0;Pensum in Excel 50 %, Tage massgebend
MA12;80;100;0;Nein;8.3;8.3;8.3;8.3;0;
MA13;50;100;0;Nein;5.19;5.19;0;5.19;5.19;
MA14;100;90;0;Nein;8.3;8.3;8.3;8.3;8.3;Ausbildung 10
MA15;100;100;0;Nein;8.3;8.3;8.3;8.3;8.3;
MA16;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3;
MA17;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3;
MA18;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3;
MA19;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3;
MA20;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3;
MA21;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3;
MA22;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3;
MA23;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3;VPL 75, KD 5, Ausbildung 20
MA24;80;80;0;Ja;8.3;8.3;8.3;0;8.3;Ausbildung 20, Do Berufsschule
MA25;80;0;60;Ja;8.3;8.3;0;8.3;8.3;Ausbildung 40, Mi Berufsschule
MA26;80;0;20;Ja;0;8.3;8.3;8.3;8.3;Ausbildung 80, Mo Berufsschule
MA27;80;0;40;Ja;8.3;8.3;8.3;8.3;0;Ausbildung 60, Fr Berufsschule
```

Kontrolle ohne Absenzen: Produktion rund 263 h pro Woche, Montage rund 332 h pro Woche.
Hinweis: Der Triviso-Bericht zeigt tiefere Wochenkapazitäten (z. B. Montage rund 207 h). Mit echten Daten prüfen.

## Testdaten (FA-02)

- Generator mit Seed: gleicher Seed ergibt gleiche Dateien, im selben Format wie der spätere Import.
- Rund 1'100 Projekte pro Jahr (NF-04), etwa 45 % Kundenprojekte und 55 % Serviceprojekte.
  Mix Kundenprojekte nach Kick-off: Allg. Schreinerarbeiten 32 %, Küchen 33 %, Schränke 9 %, Türen 7 %, Fenster 3 %.
  Service: Servicearbeiten 7 %, DL Drittfirmen 6 %.
- Status gemischt (Offerten, bestätigt, in Ausführung), Offerten vor allem weiter in der Zukunft.
- Feiertage Kanton Bern (Testannahme): 25.12.2026, 26.12.2026, 01.01.2027, 02.01.2027, 26.03.2027 (Karfreitag),
  29.03.2027 (Ostermontag), 06.05.2027 (Auffahrt), 17.05.2027 (Pfingstmontag), 01.08.2027, 25.12.2027, 26.12.2027.
- Betriebsferien über Weihnachten (Testannahme): 24.12.2026 bis 03.01.2027. Genaue Daten von Läng noch offen.
- Einige Ferien und Absenzen pro Person, damit Engpässe sichtbar werden.

## Offene Punkte (nicht raten, im Code als Annahme markieren)

1. Bedeutung Status 20 und 30 und Status der Offerten: von Läng bestätigen lassen.
2. Ob Aufträge im Tool erfasst werden können (Projektauftrag Abnahmekriterium 2) oder nur importiert werden (Katalog): Team entscheidet. Vorerst nicht bauen.
3. Importformat pro Position und Bereich statt pro Auftrag: im Team bestätigen.
4. Gilt der Einsatz aus Triviso oder der Durchschnittswert, wenn beide vorhanden sind.
5. Genaue Betriebsferien und Spaltenliste des Triviso-Exports (bis 04.12.2026, sonst Testdaten).

## Zeitplan Prototyp

- KW 47: Grundgerüst mit Testdaten lauffähig. KW 48: Zwischenpräsentation 25.11.2026, 14.00 Uhr.
- KW 49: Grobplanung 12 Monate. KW 50: Feinplanung 2 Monate, reale Daten. KW 51: Test und Abnahme (L5, 18.12.2026).
