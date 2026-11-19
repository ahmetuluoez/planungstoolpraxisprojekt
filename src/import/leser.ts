// TA-02: eine Lese-Schnittstelle je Datenart. Heute Dateien, später Triviso.
// Jeder Leser liefert gültige Datensätze und fehlerhafte Zeilen mit Grund.
import { istGueltigesDatum } from '../calc/datum';
import type { Absenz, AuftragPosition, Maschine, Mitarbeitende } from '../model/typen';
import { parseCsv, zahl } from './csv';

export type Zuordnung = Record<string, string>;

export interface ImportFehler {
  zeile: number;
  grund: string;
}

export interface ImportErgebnis<T> {
  daten: T[];
  fehler: ImportFehler[];
}

class ZeilenFehler extends Error {}

/** Liest eine Tabelle und wandelt jede Zeile mit `wandle` um. Feldnamen werden über die Zuordnung übersetzt. */
function lese<T>(
  text: string,
  zuordnung: Zuordnung,
  pflicht: string[],
  wandle: (feld: (name: string) => string) => T,
): ImportErgebnis<T> {
  const tabelle = parseCsv(text);
  const fehler: ImportFehler[] = [];
  const fehlend = pflicht.filter((f) => !tabelle.kopf.includes(zuordnung[f] ?? f));
  if (fehlend.length) {
    return { daten: [], fehler: [{ zeile: 1, grund: `Spalten fehlen: ${fehlend.map((f) => zuordnung[f] ?? f).join(', ')}` }] };
  }
  const daten: T[] = [];
  for (const { nr, werte } of tabelle.zeilen) {
    try {
      daten.push(wandle((name) => werte[zuordnung[name] ?? name] ?? ''));
    } catch (e) {
      if (e instanceof ZeilenFehler) fehler.push({ zeile: nr, grund: e.message });
      else throw e;
    }
  }
  return { daten, fehler };
}

function text(feld: (n: string) => string, name: string): string {
  const w = feld(name);
  if (w === '') throw new ZeilenFehler(`${name} fehlt`);
  return w;
}
function datum(feld: (n: string) => string, name: string): string {
  const w = text(feld, name);
  if (!istGueltigesDatum(w)) throw new ZeilenFehler(`${name} "${w}" ist kein Datum JJJJ-MM-TT`);
  return w;
}
function zahlOderNull(feld: (n: string) => string, name: string, min = 0): number | null {
  const n = zahl(feld(name));
  if (n === null) return null;
  if (Number.isNaN(n) || n < min) throw new ZeilenFehler(`${name} "${feld(name)}" ist keine gültige Zahl`);
  return n;
}
function zahlPflicht(feld: (n: string) => string, name: string): number {
  const n = zahlOderNull(feld, name);
  if (n === null) throw new ZeilenFehler(`${name} fehlt`);
  return n;
}
function jaNein(feld: (n: string) => string, name: string): boolean {
  const w = feld(name).toLowerCase();
  if (w === 'ja') return true;
  if (w === 'nein' || w === '') return false;
  throw new ZeilenFehler(`${name} "${feld(name)}" muss Ja oder Nein sein`);
}

export interface AuftragsPruefung {
  bereichWerte: Record<string, string>;
  projektarten: string[];
  statusCodes: string[];
}

export function leseAuftraege(t: string, zuordnung: Zuordnung, pruef: AuftragsPruefung): ImportErgebnis<AuftragPosition> {
  return lese(t, zuordnung, ['auftrag_nr', 'projektart', 'status', 'bereich', 'termin'], (f) => {
    const bereichRoh = text(f, 'bereich');
    const bereich = pruef.bereichWerte[bereichRoh];
    if (!bereich) throw new ZeilenFehler(`bereich "${bereichRoh}" unbekannt`);
    const projektart = text(f, 'projektart');
    if (!pruef.projektarten.includes(projektart)) throw new ZeilenFehler(`projektart "${projektart}" unbekannt`);
    const status = text(f, 'status');
    if (!pruef.statusCodes.includes(status)) throw new ZeilenFehler(`status "${status}" unbekannt`);
    const auftrag_nr = text(f, 'auftrag_nr');
    const dauer = zahlOderNull(f, 'dauer_tage', 1);
    return {
      auftrag_nr,
      position: f('position') || auftrag_nr,
      bezeichnung: f('bezeichnung'),
      projektart,
      status,
      bereich,
      termin: datum(f, 'termin'),
      dauer_tage: dauer === null ? null : Math.round(dauer),
      einsatz_std: zahlOderNull(f, 'einsatz_std'),
    };
  });
}

export function leseMitarbeitende(t: string, zuordnung: Zuordnung): ImportErgebnis<Mitarbeitende> {
  const tage = ['std_mo', 'std_di', 'std_mi', 'std_do', 'std_fr'];
  return lese(t, zuordnung, ['ma_id', ...tage, 'anteil_produktion', 'anteil_montage'], (f) => {
    const ap = zahlPflicht(f, 'anteil_produktion');
    const am = zahlPflicht(f, 'anteil_montage');
    if (ap + am > 100) throw new ZeilenFehler('anteil_produktion + anteil_montage über 100 %');
    const std = tage.map((n) => zahlPflicht(f, n)) as Mitarbeitende['std'];
    if (std.some((s) => s > 24)) throw new ZeilenFehler('Tagesstunden über 24');
    const lj = zahlOderNull(f, 'lehrjahr', 1);
    return {
      ma_id: text(f, 'ma_id'),
      name: f('name') || f('ma_id'),
      pensum: zahlOderNull(f, 'pensum') ?? 0,
      std,
      anteil_produktion: ap / 100,
      anteil_montage: am / 100,
      lernend: jaNein(f, 'lernend'),
      lehrjahr: lj,
    };
  });
}

export function leseAbsenzen(t: string, zuordnung: Zuordnung, absenzarten: string[]): ImportErgebnis<Absenz> {
  return lese(t, zuordnung, ['absenz_id', 'ma_id', 'von', 'bis', 'art'], (f) => {
    const von = datum(f, 'von');
    const bis = datum(f, 'bis');
    if (bis < von) throw new ZeilenFehler('bis liegt vor von');
    const art = text(f, 'art');
    if (!absenzarten.includes(art)) throw new ZeilenFehler(`art "${art}" unbekannt`);
    return {
      absenz_id: text(f, 'absenz_id'),
      ma_id: f('ma_id') || null,
      von,
      bis,
      stunden_pro_tag: zahlOderNull(f, 'stunden_pro_tag'),
      art,
    };
  });
}

export function leseMaschinen(t: string, zuordnung: Zuordnung, gruppen: string[]): ImportErgebnis<Maschine> {
  return lese(t, zuordnung, ['maschine_id', 'maschinengruppe', 'kapazitaet_tag'], (f) => {
    const gruppe = text(f, 'maschinengruppe');
    if (!gruppen.includes(gruppe)) throw new ZeilenFehler(`maschinengruppe "${gruppe}" unbekannt`);
    return {
      maschine_id: text(f, 'maschine_id'),
      bezeichnung: f('bezeichnung'),
      maschinengruppe: gruppe,
      kapazitaet_tag: zahlPflicht(f, 'kapazitaet_tag'),
      personalbedarf_tag: zahlOderNull(f, 'personalbedarf_tag') ?? 0,
    };
  });
}

export type Datenart = 'auftraege' | 'mitarbeitende' | 'absenzen' | 'maschinen';

/** Erkennt die Datenart am Kopf der Datei (Schlüsselspalte gemäss Zuordnung). */
export function erkenneDatenart(t: string, zuordnungen: Record<Datenart, Zuordnung>): Datenart | null {
  const kopf = parseCsv(t.split(/\r?\n/, 1)[0]).kopf;
  if (kopf.includes(zuordnungen.auftraege.auftrag_nr)) return 'auftraege';
  if (kopf.includes(zuordnungen.absenzen.absenz_id)) return 'absenzen';
  if (kopf.includes(zuordnungen.maschinen.maschine_id)) return 'maschinen';
  if (kopf.includes(zuordnungen.mitarbeitende.ma_id)) return 'mitarbeitende';
  return null;
}
