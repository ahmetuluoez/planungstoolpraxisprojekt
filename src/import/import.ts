// Import aller Datenarten über die Konfiguration. Liefert Daten und Fehler je Datei.
import codetabellen from '../../config/codetabellen.json';
import { spaltenTriviso } from '../model/konfiguration';
import type { Daten } from '../model/typen';
import {
  erkenneDatenart, leseAbsenzen, leseAuftraege, leseMaschinen, leseMitarbeitende,
  type Datenart, type ImportFehler, type Zuordnung,
} from './leser';

const zuordnungen: Record<Datenart, Zuordnung> = {
  auftraege: spaltenTriviso.auftraege,
  mitarbeitende: spaltenTriviso.mitarbeitende,
  absenzen: spaltenTriviso.absenzen,
  maschinen: spaltenTriviso.maschinen,
};

export interface DateiBericht {
  datei: string;
  datenart: Datenart | null;
  anzahl: number;
  fehler: ImportFehler[];
}

/** Liest eine Datei und ersetzt die entsprechende Datenart in `daten`. */
export function importiereDatei(name: string, text: string, daten: Daten): { daten: Daten; bericht: DateiBericht } {
  const art = erkenneDatenart(text, zuordnungen);
  const leer = { daten, bericht: { datei: name, datenart: art, anzahl: 0, fehler: [] as ImportFehler[] } };
  switch (art) {
    case 'auftraege': {
      const r = leseAuftraege(text, zuordnungen.auftraege, {
        bereichWerte: spaltenTriviso.werte.bereich,
        projektarten: codetabellen.projektart,
        statusCodes: codetabellen.status.map((s) => s.code),
      });
      return { daten: { ...daten, auftraege: r.daten }, bericht: { ...leer.bericht, anzahl: r.daten.length, fehler: r.fehler } };
    }
    case 'mitarbeitende': {
      const r = leseMitarbeitende(text, zuordnungen.mitarbeitende);
      return { daten: { ...daten, mitarbeitende: r.daten }, bericht: { ...leer.bericht, anzahl: r.daten.length, fehler: r.fehler } };
    }
    case 'absenzen': {
      const r = leseAbsenzen(text, zuordnungen.absenzen, codetabellen.absenzart);
      return { daten: { ...daten, absenzen: r.daten }, bericht: { ...leer.bericht, anzahl: r.daten.length, fehler: r.fehler } };
    }
    case 'maschinen': {
      const r = leseMaschinen(text, zuordnungen.maschinen, codetabellen.maschinengruppe.map((m) => m.code));
      return { daten: { ...daten, maschinen: r.daten }, bericht: { ...leer.bericht, anzahl: r.daten.length, fehler: r.fehler } };
    }
    default:
      return { daten, bericht: { ...leer.bericht, fehler: [{ zeile: 1, grund: 'Datenart nicht erkannt (Kopfzeile prüfen)' }] } };
  }
}

export const LEERE_DATEN: Daten = { auftraege: [], mitarbeitende: [], absenzen: [], maschinen: [] };
