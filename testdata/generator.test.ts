import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { erzeugeTestdaten } from './generator';

describe('Testdatengenerator', () => {
  it('gleicher Seed ergibt gleiche Dateien', () => {
    expect(erzeugeTestdaten(7, '2026-11-23')).toEqual(erzeugeTestdaten(7, '2026-11-23'));
    expect(erzeugeTestdaten(7, '2026-11-23')).not.toEqual(erzeugeTestdaten(8, '2026-11-23'));
  });
  it('eingecheckte Testdaten entsprechen Seed 42', () => {
    const d = erzeugeTestdaten(42, '2026-11-23');
    expect(readFileSync('testdata/auftraege.csv', 'utf8')).toBe(d['auftraege.csv']);
  });
  it('rund 1100 Projekte pro Jahr', () => {
    const d = erzeugeTestdaten(42, '2026-11-23');
    const nr = new Set(d['auftraege.csv'].trim().split('\n').slice(1).map((z) => z.split(';')[0]));
    const proJahr = (nr.size * 365) / 491;
    expect(proJahr).toBeGreaterThan(1050);
    expect(proJahr).toBeLessThan(1150);
  });
});
