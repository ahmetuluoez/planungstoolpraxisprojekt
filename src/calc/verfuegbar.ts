// FA-05: verfügbar je Tag und Bereich.
import type { Absenz, Datum, Maschine, Mitarbeitende } from '../model/typen';
import { tageZwischen, wochentag } from './datum';
import type { IstArbeitstag } from './kalender';

export interface VerfuegbarTag {
  Produktion: number;
  Montage: number;
}

/**
 * Tagesstunden der Person (std_mo bis std_fr) abzüglich Absenzen, dann mal Bereichsanteil.
 * Auslegung: Absenzen werden von den Tagesstunden abgezogen (höchstens bis 0), danach wird aufgeteilt.
 * Lernende: der Berufsschultag hat 0 Tagesstunden und ist damit schon abgezogen.
 */
export function verfuegbarJeTag(
  mitarbeitende: Mitarbeitende[],
  absenzen: Absenz[],
  tage: Datum[],
  istArbeitstag: IstArbeitstag,
): Map<Datum, VerfuegbarTag> {
  const imBereich = new Set(tage);
  // abwesende Stunden je Person und Tag; Schlüssel "ma_id|datum", ma_id "*" = alle
  const abwesend = new Map<string, number | null>();
  for (const a of absenzen) {
    if (a.ma_id === null && a.stunden_pro_tag === null) continue; // geschlossener Tag, siehe kalender.ts
    for (const t of tageZwischen(a.von, a.bis)) {
      if (!imBereich.has(t)) continue;
      const k = `${a.ma_id ?? '*'}|${t}`;
      const bisher = abwesend.get(k);
      // null = ganzer Tag
      abwesend.set(k, a.stunden_pro_tag === null || bisher === null ? null : (bisher ?? 0) + a.stunden_pro_tag);
    }
  }
  const abzug = (k: string, h: number) => {
    if (!abwesend.has(k)) return 0;
    const v = abwesend.get(k);
    return v === null || v === undefined ? h : v;
  };

  const out = new Map<Datum, VerfuegbarTag>();
  for (const t of tage) {
    const v: VerfuegbarTag = { Produktion: 0, Montage: 0 };
    if (istArbeitstag(t)) {
      const wt = wochentag(t);
      for (const m of mitarbeitende) {
        const h = m.std[wt] ?? 0;
        if (h <= 0) continue;
        const rest = Math.max(0, h - abzug(`${m.ma_id}|${t}`, h) - abzug(`*|${t}`, h));
        v.Produktion += rest * m.anteil_produktion;
        v.Montage += rest * m.anteil_montage;
      }
    }
    out.set(t, v);
  }
  return out;
}

/** Kapazität je Maschinengruppe und Tag (PP-02). Maschinen laufen Montag bis Freitag. */
export function maschinenKapazitaetTag(maschinen: Maschine[], gruppe: string, d: Datum, istArbeitstag: IstArbeitstag): number {
  if (!istArbeitstag(d)) return 0;
  return maschinen.filter((m) => m.maschinengruppe === gruppe).reduce((s, m) => s + m.kapazitaet_tag, 0);
}
