import type { Absenz, Datum } from '../model/typen';
import { istWerktag, tageZwischen } from './datum';

/**
 * Tage, an denen der Betrieb geschlossen ist: Absenzen ohne ma_id und ohne stunden_pro_tag
 * (Feiertag, Betriebsferien). Regel unabhängig von der Absenzart, damit die Codetabelle frei bleibt.
 */
export function geschlosseneTage(absenzen: Absenz[]): Set<Datum> {
  const s = new Set<Datum>();
  for (const a of absenzen) {
    if (a.ma_id === null && a.stunden_pro_tag === null) tageZwischen(a.von, a.bis).forEach((t) => s.add(t));
  }
  return s;
}

export type IstArbeitstag = (d: Datum) => boolean;

export function arbeitstagPruefer(absenzen: Absenz[]): IstArbeitstag {
  const zu = geschlosseneTage(absenzen);
  return (d) => istWerktag(d) && !zu.has(d);
}
