import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importiereDatei, LEERE_DATEN } from '../import/import';
import { ladeStammdaten, ladeStartparameter } from '../model/konfiguration';
import type { Absenz, AuftragPosition, Daten } from '../model/typen';
import { ampel, berechne } from './auslastung';
import { bedarfJeZeile } from './bedarf';
import { kalenderwoche, tageZwischen } from './datum';
import { arbeitstagPruefer } from './kalender';
import { verfuegbarJeTag } from './verfuegbar';
import { verteile } from './verteilung';

const stamm = ladeStammdaten();
const param = ladeStartparameter();

function ladeTestdaten(): Daten {
  let d = LEERE_DATEN;
  for (const f of ['mitarbeitende', 'maschinen', 'absenzen', 'auftraege']) {
    const r = importiereDatei(f, readFileSync(`testdata/${f}.csv`, 'utf8'), d);
    expect(r.bericht.fehler).toEqual([]);
    d = r.daten;
  }
  return d;
}

describe('Kalender', () => {
  it('Kalenderwoche', () => {
    expect(kalenderwoche('2026-11-23')).toEqual({ jahr: 2026, kw: 48 });
    expect(kalenderwoche('2027-01-01')).toEqual({ jahr: 2026, kw: 53 });
  });
});

describe('FA-05 verfügbar', () => {
  const d = ladeTestdaten();
  const woche = tageZwischen('2026-11-23', '2026-11-29');

  it('Kontrollsummen ohne Absenzen: Produktion rund 263 h, Montage rund 332 h pro Woche', () => {
    const v = verfuegbarJeTag(d.mitarbeitende, [], woche, arbeitstagPruefer([]));
    const p = [...v.values()].reduce((s, x) => s + x.Produktion, 0);
    const m = [...v.values()].reduce((s, x) => s + x.Montage, 0);
    expect(p).toBeCloseTo(263.12, 1);
    expect(m).toBeCloseTo(332.4, 1);
  });

  it('Feiertag und Betriebsferien = 0, Ferien werden abgezogen', () => {
    const abs: Absenz[] = [
      { absenz_id: 'F', ma_id: null, von: '2026-11-24', bis: '2026-11-24', stunden_pro_tag: null, art: 'Feiertag' },
      { absenz_id: 'X', ma_id: 'MA10', von: '2026-11-25', bis: '2026-11-25', stunden_pro_tag: null, art: 'Ferien' },
      { absenz_id: 'Y', ma_id: 'MA15', von: '2026-11-26', bis: '2026-11-26', stunden_pro_tag: 4.15, art: 'Weiterbildung' },
    ];
    const v = verfuegbarJeTag(d.mitarbeitende, abs, woche, arbeitstagPruefer(abs));
    expect(v.get('2026-11-24')!.Produktion).toBe(0);
    expect(v.get('2026-11-29')!.Produktion).toBe(0); // Sonntag
    // Mittwoch ohne Absenz 54,78 h (MA13 arbeitet nicht), MA10 ganzer Tag weg
    expect(v.get('2026-11-25')!.Produktion).toBeCloseTo(54.78 - 8.3, 2);
    // Donnerstag ohne Absenz 53,33 h (MA24 Berufsschule), MA15 halber Tag weg
    expect(v.get('2026-11-26')!.Produktion).toBeCloseTo(53.33 - 4.15, 2);
  });

  it('Lernende: Berufsschultag nicht nochmals abziehen', () => {
    const ma24 = d.mitarbeitende.filter((m) => m.ma_id === 'MA24');
    const abs: Absenz[] = [{ absenz_id: 'S', ma_id: 'MA24', von: '2026-11-26', bis: '2026-11-26', stunden_pro_tag: null, art: 'Sonstiges' }];
    const v = verfuegbarJeTag(ma24, abs, ['2026-11-26'], arbeitstagPruefer([]));
    expect(v.get('2026-11-26')!.Produktion).toBe(0);
  });
});

describe('FA-07 Verteilung', () => {
  const at = arbeitstagPruefer([]);
  it('gleichmässig über dauer_tage, Wochenende übersprungen', () => {
    const r = verteile(30, '2026-11-26', 3, 8.3, at);
    expect(r).toEqual([['2026-11-26', 10], ['2026-11-27', 10], ['2026-11-30', 10]]);
  });
  it('ohne Dauer: Tage auffüllen mit 16,6 h', () => {
    const r = verteile(40, '2026-11-23', null, 16.6, at);
    expect(r.map((x) => x[1])).toEqual([16.6, 16.6, expect.closeTo(6.8, 5)]);
  });
});

describe('FA-06 Bedarf', () => {
  const zeile: AuftragPosition = {
    auftrag_nr: 'L.1', position: 'L.1.01', bezeichnung: '', projektart: 'Küchen', status: '20',
    bereich: 'Montage', termin: '2026-11-23', dauer_tage: 2, einsatz_std: 100,
  };
  it('Durchschnittswert gilt: Küchen Montage 27,48 h, aufgeteilt auf Positionen', () => {
    const s1 = bedarfJeZeile(zeile, 1, param, stamm).reduce((s, x) => s + x.stunden, 0);
    expect(s1).toBeCloseTo(27.48, 2);
    const s2 = bedarfJeZeile(zeile, 2, param, stamm).reduce((s, x) => s + x.stunden, 0);
    expect(s2).toBeCloseTo(13.74, 2);
  });
  it('Küchen Produktion 22,3 h, davon BC 4,14 h', () => {
    const b = bedarfJeZeile({ ...zeile, bereich: 'Produktion' }, 1, param, stamm);
    expect(b.reduce((s, x) => s + x.stunden, 0)).toBeCloseTo(22.3, 1);
    expect(b.find((x) => x.maschinengruppe === 'BC')!.stunden).toBeCloseTo(4.14, 2);
  });
  it('Variante Einsatz: Einsatz anteilig auf Schritte', () => {
    const b = bedarfJeZeile(zeile, 1, { ...param, bedarf_quelle: 'einsatz' }, stamm);
    expect(b.reduce((s, x) => s + x.stunden, 0)).toBeCloseTo(100, 6);
  });
});

describe('FA-08 Auslastung', () => {
  it('Ampel', () => {
    expect(ampel(90, 100, 0.9)).toBe('frei');
    expect(ampel(95, 100, 0.9)).toBe('knapp');
    expect(ampel(100, 100, 0.9)).toBe('knapp');
    expect(ampel(101, 100, 0.9)).toBe('engpass');
    expect(ampel(1, 0, 0.9)).toBe('engpass');
  });
  it('Offerten zählen nicht zur Auslastung', () => {
    const d: Daten = { ...ladeTestdaten(), auftraege: [{
      auftrag_nr: 'L.1', position: 'L.1', bezeichnung: '', projektart: 'Küchen', status: '10',
      bereich: 'Montage', termin: '2026-11-23', dauer_tage: 1, einsatz_std: null,
    }] };
    const e = berechne(d, param, stamm, '2026-11-23', 1);
    expect(e.wochen[0].werte.Montage.geplant).toBe(0);
    expect(e.wochen[0].werte.Montage.offerte).toBeCloseTo(27.48, 2);
  });
  it('rechnet die Testdaten für 52 Wochen', () => {
    const e = berechne(ladeTestdaten(), param, stamm, '2026-11-23');
    expect(e.wochen).toHaveLength(52);
    expect(e.ressourcen).toEqual(['Produktion', 'Montage', 'BC', 'BBS', 'KLM', 'SPR', 'PZ']);
    expect(e.wochen[0].werte.BC.verfuegbar).toBe(75);
    // Betriebsferien: KW 53/26 (28.12. bis 01.01.) ohne Kapazität
    const kw53 = e.wochen.find((w) => w.label === 'KW 53/26')!;
    expect(kw53.werte.Produktion.verfuegbar).toBe(0);
  });
});
