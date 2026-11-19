// Datumsfunktionen auf Basis UTC, damit Zeitzonen keine Rolle spielen.
import type { Datum } from '../model/typen';

const TAG_MS = 86_400_000;

export function zuZahl(d: Datum): number {
  const [j, m, t] = d.split('-').map(Number);
  return Date.UTC(j, m - 1, t) / TAG_MS;
}

export function vonZahl(n: number): Datum {
  return new Date(n * TAG_MS).toISOString().slice(0, 10);
}

export function plusTage(d: Datum, tage: number): Datum {
  return vonZahl(zuZahl(d) + tage);
}

/** 0 = Montag bis 6 = Sonntag */
export function wochentag(d: Datum): number {
  return (new Date(zuZahl(d) * TAG_MS).getUTCDay() + 6) % 7;
}

export function istWerktag(d: Datum): boolean {
  return wochentag(d) < 5;
}

export function montagDerWoche(d: Datum): Datum {
  return plusTage(d, -wochentag(d));
}

/** ISO-Kalenderwoche, z. B. { jahr: 2026, kw: 48 } */
export function kalenderwoche(d: Datum): { jahr: number; kw: number } {
  const donnerstag = plusTage(d, 3 - wochentag(d));
  const jahr = Number(donnerstag.slice(0, 4));
  const ersterJan = zuZahl(`${jahr}-01-01`);
  const kw = Math.floor((zuZahl(donnerstag) - ersterJan) / 7) + 1;
  return { jahr, kw };
}

/** Alle Tage von bis einschliesslich */
export function tageZwischen(von: Datum, bis: Datum): Datum[] {
  const out: Datum[] = [];
  for (let n = zuZahl(von); n <= zuZahl(bis); n++) out.push(vonZahl(n));
  return out;
}

export function istGueltigesDatum(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return vonZahl(zuZahl(s)) === s;
}
