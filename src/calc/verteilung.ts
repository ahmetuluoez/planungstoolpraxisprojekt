// FA-07: Verteilregel. Bewusst in genau einer Funktion, damit sie leicht änderbar ist.
import type { Datum } from '../model/typen';
import { plusTage } from './datum';
import type { IstArbeitstag } from './kalender';

const MAX_TAGE = 2000; // Schutz gegen Endlosschleifen

/**
 * Verteilt `stunden` auf Arbeitstage ab `termin`.
 * - dauer_tage vorhanden: gleichmässig über so viele Arbeitstage (wie Triviso).
 * - sonst "Tage auffüllen" mit `stundenProTag` (Montage PP-04 16,6 h, Produktion vorläufig 8,3 h).
 * Liefert je Arbeitstag die Stunden.
 */
export function verteile(
  stunden: number,
  termin: Datum,
  dauerTage: number | null,
  stundenProTag: number,
  istArbeitstag: IstArbeitstag,
): [Datum, number][] {
  if (stunden <= 0) return [];
  const out: [Datum, number][] = [];
  let tag = termin;
  if (dauerTage && dauerTage > 0) {
    const jeTag = stunden / dauerTage;
    for (let i = 0; out.length < dauerTage && i < MAX_TAGE; i++, tag = plusTage(tag, 1)) {
      if (istArbeitstag(tag)) out.push([tag, jeTag]);
    }
    return out;
  }
  let rest = stunden;
  for (let i = 0; rest > 1e-9 && i < MAX_TAGE; i++, tag = plusTage(tag, 1)) {
    if (!istArbeitstag(tag)) continue;
    const h = Math.min(rest, stundenProTag);
    out.push([tag, h]);
    rest -= h;
  }
  return out;
}
