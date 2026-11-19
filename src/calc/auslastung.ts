// FA-08: Auslastung = geplant ÷ verfügbar, je Tag und Woche, für Produktion, Montage und jede Maschinengruppe.
// Offerten zählen nicht zur Auslastung, sie werden separat geführt (FA-13).
import type { Belegung, Daten, Datum, Parameter, Stammdaten } from '../model/typen';
import { berechneBelegungen } from './bedarf';
import { kalenderwoche, montagDerWoche, plusTage, tageZwischen } from './datum';
import { arbeitstagPruefer } from './kalender';
import { maschinenKapazitaetTag, verfuegbarJeTag } from './verfuegbar';

export type Ampel = 'frei' | 'knapp' | 'engpass';

export interface Wert {
  verfuegbar: number;
  geplant: number;
  offerte: number;
  auslastung: number | null;
  ampel: Ampel;
  /** Ampel, wenn alle Offerten angenommen würden */
  ampelMitOfferten: Ampel;
}

export interface Periode {
  /** Datum (Tag) oder Montag der Woche */
  datum: Datum;
  label: string;
  werte: Record<string, Wert>;
}

export interface Ergebnis {
  ressourcen: string[];
  tage: Periode[];
  wochen: Periode[];
  belegungen: Belegung[];
}

/** Ampel FA-14: bis Warnschwelle frei, bis 100 % knapp, darüber Engpass. */
export function ampel(geplant: number, verfuegbar: number, warnschwelle: number): Ampel {
  if (geplant <= 0) return 'frei';
  if (verfuegbar <= 0) return 'engpass';
  const q = geplant / verfuegbar;
  if (q <= warnschwelle + 1e-9) return 'frei';
  if (q <= 1 + 1e-9) return 'knapp';
  return 'engpass';
}

function wert(verfuegbar: number, geplant: number, offerte: number, ws: number): Wert {
  return {
    verfuegbar,
    geplant,
    offerte,
    auslastung: verfuegbar > 0 ? geplant / verfuegbar : null,
    ampel: ampel(geplant, verfuegbar, ws),
    ampelMitOfferten: ampel(geplant + offerte, verfuegbar, ws),
  };
}

/** Rechnet alles neu (FA-10). Zeitraum: `wochen` Wochen ab der Woche des Stichtags. */
export function berechne(daten: Daten, param: Parameter, stamm: Stammdaten, stichtag: Datum, wochen = 52): Ergebnis {
  const istArbeitstag = arbeitstagPruefer(daten.absenzen);
  const start = montagDerWoche(stichtag);
  const tage = tageZwischen(start, plusTage(start, wochen * 7 - 1));
  const ressourcen = [...stamm.geplanteBereiche, ...stamm.maschinengruppen];

  const verf = verfuegbarJeTag(daten.mitarbeitende, daten.absenzen, tage, istArbeitstag);
  const belegungen = berechneBelegungen(daten.auftraege, param, stamm, istArbeitstag);

  // geplant und Offerte je Tag und Ressource
  const summe = new Map<string, { g: number; o: number }>();
  const add = (r: string, d: Datum, h: number, off: boolean) => {
    const k = `${r}|${d}`;
    const s = summe.get(k) ?? { g: 0, o: 0 };
    if (off) s.o += h; else s.g += h;
    summe.set(k, s);
  };
  for (const b of belegungen) {
    add(b.bereich, b.datum, b.stunden, b.offerte);
    if (b.maschinengruppe) add(b.maschinengruppe, b.datum, b.stunden, b.offerte);
  }

  const verfuegbarVon = (r: string, d: Datum): number => {
    if (r === 'Produktion' || r === 'Montage') return verf.get(d)?.[r] ?? 0;
    return maschinenKapazitaetTag(daten.maschinen, r, d, istArbeitstag);
  };

  const tagPerioden: Periode[] = tage.map((d) => ({
    datum: d,
    label: d,
    werte: Object.fromEntries(
      ressourcen.map((r) => {
        const s = summe.get(`${r}|${d}`) ?? { g: 0, o: 0 };
        return [r, wert(verfuegbarVon(r, d), s.g, s.o, param.warnschwelle)];
      }),
    ),
  }));

  const wochenPerioden: Periode[] = [];
  for (let w = 0; w < wochen; w++) {
    const teil = tagPerioden.slice(w * 7, w * 7 + 7);
    const { jahr, kw } = kalenderwoche(teil[0].datum);
    wochenPerioden.push({
      datum: teil[0].datum,
      label: `KW ${kw}/${String(jahr).slice(2)}`,
      werte: Object.fromEntries(
        ressourcen.map((r) => {
          const v = teil.reduce((s, p) => s + p.werte[r].verfuegbar, 0);
          const g = teil.reduce((s, p) => s + p.werte[r].geplant, 0);
          const o = teil.reduce((s, p) => s + p.werte[r].offerte, 0);
          return [r, wert(v, g, o, param.warnschwelle)];
        }),
      ),
    });
  }
  return { ressourcen, tage: tagPerioden, wochen: wochenPerioden, belegungen };
}
