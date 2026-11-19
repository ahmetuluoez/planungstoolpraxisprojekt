import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import { importiereDatei, LEERE_DATEN } from './import';

describe('CSV', () => {
  it('liest Semikolon, Anführungszeichen, BOM und Komma als Dezimalzeichen', () => {
    const t = parseCsv('﻿a;b\r\n"x;y";1,5\n');
    expect(t.kopf).toEqual(['a', 'b']);
    expect(t.zeilen[0].werte).toEqual({ a: 'x;y', b: '1,5' });
  });
});

describe('Import Aufträge', () => {
  const kopf = 'auftrag_nr;position;bezeichnung;projektart;status;bereich;termin;dauer_tage;einsatz_std';
  it('übersetzt Werkstatt zu Produktion und meldet fehlerhafte Zeilen mit Grund', () => {
    const text = [
      kopf,
      'L.1;L.1.01;Test;Küchen;20;Werkstatt;2026-11-23;3;20',
      'L.2;L.2.01;Test;Küchen;20;Werkstatt;23.11.2026;3;20',
      'L.3;L.3.01;Test;Boote;20;Montage;2026-11-23;3;20',
      'L.4;L.4.01;Test;Küchen;99;Montage;2026-11-23;;',
    ].join('\n');
    const r = importiereDatei('a.csv', text, LEERE_DATEN);
    expect(r.bericht.datenart).toBe('auftraege');
    expect(r.daten.auftraege).toHaveLength(1);
    expect(r.daten.auftraege[0].bereich).toBe('Produktion');
    expect(r.bericht.fehler.map((f) => f.zeile)).toEqual([3, 4, 5]);
    expect(r.bericht.fehler[0].grund).toContain('JJJJ-MM-TT');
  });
  it('meldet fehlende Spalten', () => {
    const r = importiereDatei('a.csv', 'auftrag_nr;status\nL.1;20', LEERE_DATEN);
    expect(r.bericht.fehler[0].grund).toContain('Spalten fehlen');
  });
});
