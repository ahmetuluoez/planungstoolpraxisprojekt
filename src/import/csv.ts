// CSV lesen (TA-07): UTF-8, Semikolon, Anführungszeichen erlaubt.

export interface CsvTabelle {
  kopf: string[];
  /** Zeilen ohne Kopf, jede mit Zeilennummer in der Datei (1 = Kopf) */
  zeilen: { nr: number; werte: Record<string, string> }[];
}

export function parseCsv(text: string, trenner = ';'): CsvTabelle {
  const roh = text.replace(/^﻿/, '');
  const reihen: string[][] = [];
  let feld = '';
  let reihe: string[] = [];
  let inQuote = false;
  for (let i = 0; i < roh.length; i++) {
    const c = roh[i];
    if (inQuote) {
      if (c === '"' && roh[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inQuote = false;
      else feld += c;
    } else if (c === '"') inQuote = true;
    else if (c === trenner) { reihe.push(feld); feld = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && roh[i + 1] === '\n') i++;
      reihe.push(feld); reihen.push(reihe); reihe = []; feld = '';
    } else feld += c;
  }
  if (feld !== '' || reihe.length) { reihe.push(feld); reihen.push(reihe); }

  const [kopfRoh = [], ...rest] = reihen;
  const kopf = kopfRoh.map((k) => k.trim());
  const zeilen = rest
    .map((r, i) => ({ nr: i + 2, r }))
    .filter(({ r }) => r.some((w) => w.trim() !== ''))
    .map(({ nr, r }) => ({
      nr,
      werte: Object.fromEntries(kopf.map((k, j) => [k, (r[j] ?? '').trim()])),
    }));
  return { kopf, zeilen };
}

/** Zahl mit Punkt oder Komma. Leer = null. */
export function zahl(s: string): number | null {
  if (s === '') return null;
  const n = Number(s.replace(/'/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}
