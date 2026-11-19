// Testdatengenerator (FA-02). Gleicher Seed ergibt gleiche Dateien.
// Aufruf: npx tsx testdata/generator.ts --seed 42 --stichtag 2026-11-23 [--out testdata]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { istWerktag, plusTage, tageZwischen, zuZahl } from '../src/calc/datum';
import { ladeStammdaten, ladeStartparameter } from '../src/model/konfiguration';

// ---------- Zufall mit Seed ----------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Feste Testannahmen aus CLAUDE.md ----------
const FEIERTAGE = [
  '2026-12-25', '2026-12-26', '2027-01-01', '2027-01-02', '2027-03-26', '2027-03-29',
  '2027-05-06', '2027-05-17', '2027-08-01', '2027-12-25', '2027-12-26',
];
const BETRIEBSFERIEN = [{ von: '2026-12-24', bis: '2027-01-03' }]; // Testannahme, Daten von Läng offen

// Mitarbeitende anonymisiert (Ressourcen-Datei, korrigiert). Anteile in Prozent.
const MITARBEITENDE = `ma_id;pensum;anteil_produktion;anteil_montage;lernend;std_mo;std_di;std_mi;std_do;std_fr
MA01;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3
MA02;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3
MA03;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3
MA04;100;0;5;Nein;8.3;8.3;8.3;8.3;8.3
MA05;20;0;0;Nein;0;0;8.3;0;0
MA06;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3
MA07;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3
MA08;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3
MA09;100;90;0;Nein;8.3;8.3;8.3;8.3;8.3
MA10;100;100;0;Nein;8.3;8.3;8.3;8.3;8.3
MA11;60;100;0;Nein;0;8.3;8.3;8.3;0
MA12;80;100;0;Nein;8.3;8.3;8.3;8.3;0
MA13;50;100;0;Nein;5.19;5.19;0;5.19;5.19
MA14;100;90;0;Nein;8.3;8.3;8.3;8.3;8.3
MA15;100;100;0;Nein;8.3;8.3;8.3;8.3;8.3
MA16;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3
MA17;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3
MA18;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3
MA19;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3
MA20;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3
MA21;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3
MA22;100;0;100;Nein;8.3;8.3;8.3;8.3;8.3
MA23;100;0;0;Nein;8.3;8.3;8.3;8.3;8.3
MA24;80;80;0;Ja;8.3;8.3;8.3;0;8.3
MA25;80;0;60;Ja;8.3;8.3;0;8.3;8.3
MA26;80;0;20;Ja;0;8.3;8.3;8.3;8.3
MA27;80;0;40;Ja;8.3;8.3;8.3;8.3;0`;
const LEHRJAHR: Record<string, number> = { MA24: 3, MA25: 2, MA26: 1, MA27: 4 }; // Testannahme

const MASCHINEN = [
  ['BC1', 'Bearbeitungscenter M1', 'BC', 7.5, 8.3],
  ['BC2', 'Bearbeitungscenter M2', 'BC', 7.5, 8.3],
  ['BBS', 'Breitbandschleifen', 'BBS', 8, 8.3],
  ['KLM', 'Kantenleimmaschine', 'KLM', 7, 8.3],
  ['SPR', 'Oberfläche (Spritzraum)', 'SPR', 7, 8.3],
  ['PZ', 'Plattenzuschnitt', 'PZ', 8, 8.3],
] as const;

// Mix der Projektarten (Anteil an allen Projekten, CLAUDE.md "Mix nach Kick-off").
// Annahme: Vertrieb und Projektleitung erhält den Rest auf 100 %.
const MIX: [string, number][] = [
  ['Allgemeine Schreinerarbeiten', 32], ['Küchen', 33], ['Schränke', 9], ['Türen', 7],
  ['Fenster', 3], ['Service', 7], ['DL Drittfirma', 6], ['Vertrieb und Projektleitung', 3],
];
const SERVICE_ARTEN = new Set(['Service', 'DL Drittfirma']);
const PROJEKTE_PRO_JAHR = 1100; // NF-04

export interface Dateien {
  'auftraege.csv': string;
  'mitarbeitende.csv': string;
  'absenzen.csv': string;
  'maschinen.csv': string;
}

export function erzeugeTestdaten(seed: number, stichtag: string): Dateien {
  const rnd = mulberry32(seed);
  const zwischen = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const wahl = <T,>(liste: [T, number][]): T => {
    const summe = liste.reduce((s, [, g]) => s + g, 0);
    let r = rnd() * summe;
    for (const [w, g] of liste) if ((r -= g) < 0) return w;
    return liste[liste.length - 1][0];
  };
  const rauschen = () => Math.exp((rnd() + rnd() + rnd() - 1.5) * 0.5); // um 1 streuend
  const r1 = (x: number) => Math.round(x * 10) / 10;

  const von = plusTage(stichtag, -91);
  const bis = plusTage(stichtag, 400);
  const geschlossen = new Set<string>(FEIERTAGE);
  for (const b of BETRIEBSFERIEN) tageZwischen(b.von, b.bis).forEach((t) => geschlossen.add(t));
  const arbeitstage = tageZwischen(von, bis).filter((t) => istWerktag(t) && !geschlossen.has(t));
  const nachArbeitstagen = (t: string, n: number): string => {
    let i = arbeitstage.findIndex((a) => a >= t);
    if (i < 0) i = arbeitstage.length - 1;
    return arbeitstage[Math.max(0, Math.min(arbeitstage.length - 1, i + n))];
  };

  // ---------- Mitarbeitende ----------
  const maZeilen = MITARBEITENDE.split('\n').slice(1).map((z) => z.split(';'));
  const mitarbeitende = [
    'ma_id;name;pensum;std_mo;std_di;std_mi;std_do;std_fr;anteil_produktion;anteil_montage;lernend;lehrjahr',
    ...maZeilen.map(([id, pensum, ap, am, lern, ...std]) =>
      [id, id, pensum, ...std, ap, am, lern, LEHRJAHR[id] ?? ''].join(';'),
    ),
  ].join('\n');

  // ---------- Maschinen ----------
  const maschinen = [
    'maschine_id;bezeichnung;maschinengruppe;kapazitaet_tag;personalbedarf_tag',
    ...MASCHINEN.map((m) => m.join(';')),
  ].join('\n');

  // ---------- Absenzen ----------
  const abs: string[][] = [];
  let absNr = 1;
  const neueAbsenz = (ma: string, v: string, b: string, std: string, art: string) =>
    abs.push([`A${String(absNr++).padStart(5, '0')}`, ma, v, b, std, art]);
  for (const t of FEIERTAGE) neueAbsenz('', t, t, '', 'Feiertag');
  for (const b of BETRIEBSFERIEN) neueAbsenz('', b.von, b.bis, '', 'Betriebsferien');
  const sommer = arbeitstage.filter((t) => t >= '2027-07-01' && t <= '2027-08-20');
  for (const [id] of maZeilen) {
    // Ferien: zwei Wochen im Sommer (gehäuft), dazu zwei einzelne Wochen übers Jahr
    const s = sommer[zwischen(0, Math.max(0, sommer.length - 10))];
    if (s) neueAbsenz(id, s, nachArbeitstagen(s, 9), '', 'Ferien');
    for (let k = 0; k < 2; k++) {
      const st = arbeitstage[zwischen(0, arbeitstage.length - 6)];
      neueAbsenz(id, st, nachArbeitstagen(st, 4), '', 'Ferien');
    }
    for (let k = zwischen(0, 3); k > 0; k--) {
      const st = arbeitstage[zwischen(0, arbeitstage.length - 4)];
      neueAbsenz(id, st, nachArbeitstagen(st, zwischen(0, 2)), '', 'Krankheit');
    }
    if (rnd() < 0.3) {
      const st = arbeitstage[zwischen(0, arbeitstage.length - 1)];
      neueAbsenz(id, st, st, '4.15', 'Weiterbildung');
    }
  }
  const absenzen = ['absenz_id;ma_id;von;bis;stunden_pro_tag;art', ...abs.map((z) => z.join(';'))].join('\n');

  // ---------- Aufträge, eine Zeile pro Position und Bereich ----------
  const param = ladeStartparameter();
  const stamm = ladeStammdaten();
  const bereichStd = (pa: string, bereich: string) =>
    stamm.arbeitsschritte
      .filter((s) => s.bereich === bereich)
      .reduce((sum, s) => sum + (param.durchschnittswerte[pa]?.[s.code] ?? 0), 0);

  const anzahl = Math.round((PROJEKTE_PRO_JAHR * (zuZahl(bis) - zuZahl(von))) / 365);
  const zeilen: string[] = [];
  let nrL = 260001;
  let nrS = 260001;
  for (let i = 0; i < anzahl; i++) {
    const pa = wahl(MIX);
    const service = SERVICE_ARTEN.has(pa);
    const auftrag_nr = service ? `S.${nrS++}` : `L.${nrL++}`;
    const nPos = service ? 1 : wahl([[1, 65], [2, 25], [3, 10]]);
    const start = arbeitstage[zwischen(0, arbeitstage.length - 1)];
    const tageBisStart = zuZahl(start) - zuZahl(stichtag);
    // Status (Annahme: 10 Offerte, 20 bestätigt, 30 in Ausführung). Offerten vor allem weiter in der Zukunft.
    let status: string;
    if (tageBisStart < 0) status = rnd() < 0.9 ? '30' : '20';
    else status = rnd() < Math.min(0.7, 0.05 + (tageBisStart / 365) * 0.8) ? '10' : '20';

    for (let p = 1; p <= nPos; p++) {
      const position = service ? auftrag_nr : `${auftrag_nr}.${String(p).padStart(2, '0')}`;
      const bezeichnung = `${pa} Testprojekt ${auftrag_nr}`;
      const pStart = nachArbeitstagen(start, zwischen(0, 4));
      const hProd = (bereichStd(pa, 'Produktion') / nPos) * rauschen();
      const hMont = (bereichStd(pa, 'Montage') / nPos) * rauschen();
      const hPlan = (bereichStd(pa, 'Vertrieb/Projektleitung') / nPos) * rauschen();
      const dauerProd = Math.max(1, Math.ceil(hProd / 8.3) + zwischen(0, 2));
      const dauerMont = Math.max(1, Math.ceil(hMont / 16.6) + zwischen(0, 1));
      const termMont = nachArbeitstagen(pStart, dauerProd + zwischen(2, 10));
      const termPlan = nachArbeitstagen(pStart, -zwischen(5, 15));
      const dauer = (d: number) => (rnd() < 0.1 ? '' : String(d)); // einige ohne Dauer: Regel "Tage auffüllen"
      const zeile = (bereich: string, termin: string, d: string, h: number) =>
        zeilen.push([auftrag_nr, position, bezeichnung, pa, status, bereich, termin, d, r1(h)].join(';'));
      if (hPlan >= 0.05) zeile('Planung', termPlan, String(Math.max(1, zwischen(1, 3))), hPlan);
      if (hProd >= 0.05) zeile('Werkstatt', pStart, dauer(dauerProd), hProd);
      if (hMont >= 0.05) zeile('Montage', termMont, dauer(dauerMont), hMont);
    }
  }
  const auftraege = [
    'auftrag_nr;position;bezeichnung;projektart;status;bereich;termin;dauer_tage;einsatz_std',
    ...zeilen,
  ].join('\n');

  return {
    'auftraege.csv': auftraege + '\n',
    'mitarbeitende.csv': mitarbeitende + '\n',
    'absenzen.csv': absenzen + '\n',
    'maschinen.csv': maschinen + '\n',
  };
}

// ---------- Kommandozeile ----------
function arg(name: string, standard: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : standard;
}

if (process.argv[1]?.endsWith('generator.ts')) {
  const seed = Number(arg('seed', '42'));
  const stichtag = arg('stichtag', '2026-11-23');
  const out = arg('out', 'testdata');
  mkdirSync(out, { recursive: true });
  const dateien = erzeugeTestdaten(seed, stichtag);
  for (const [name, inhalt] of Object.entries(dateien)) {
    writeFileSync(join(out, name), inhalt, 'utf8');
    console.log(`${join(out, name)}: ${inhalt.trim().split('\n').length - 1} Zeilen`);
  }
}
