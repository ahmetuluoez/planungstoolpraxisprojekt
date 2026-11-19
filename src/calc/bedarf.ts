// FA-06: Stundenbedarf je Position, Bereich und Arbeitsschritt.
import type { AuftragPosition, Belegung, Parameter, Stammdaten } from '../model/typen';
import type { IstArbeitstag } from './kalender';
import { verteile } from './verteilung';

export interface SchrittBedarf {
  arbeitsschritt: string;
  stunden: number;
  maschinengruppe: string | null;
}

/**
 * Bedarf einer Importzeile (Position und Bereich).
 * bedarf_quelle "durchschnittswert" (Entscheid zu offenem Punkt 4): Durchschnittswert der Projektart je Schritt.
 *   Annahme: Durchschnittswerte gelten pro Auftrag; hat ein Auftrag mehrere Positionen im selben Bereich,
 *   wird der Wert gleichmässig auf diese Positionen aufgeteilt.
 * bedarf_quelle "einsatz": einsatz_std gilt für den Bereich, Aufteilung anteilig nach Durchschnittswerten.
 */
export function bedarfJeZeile(
  zeile: AuftragPosition,
  positionenImBereich: number,
  param: Parameter,
  stamm: Stammdaten,
): SchrittBedarf[] {
  const dw = param.durchschnittswerte[zeile.projektart] ?? {};
  const schritte = stamm.arbeitsschritte
    .filter((s) => s.bereich === zeile.bereich && (dw[s.code] ?? 0) > 0)
    .map((s) => ({ arbeitsschritt: s.code, stunden: dw[s.code], maschinengruppe: s.maschinengruppe }));

  if (param.bedarf_quelle === 'einsatz' && zeile.einsatz_std !== null) {
    const summe = schritte.reduce((s, x) => s + x.stunden, 0);
    if (summe === 0) return [{ arbeitsschritt: zeile.bereich, stunden: zeile.einsatz_std, maschinengruppe: null }];
    return schritte.map((x) => ({ ...x, stunden: (x.stunden / summe) * zeile.einsatz_std! }));
  }
  const teiler = Math.max(1, positionenImBereich);
  return schritte.map((x) => ({ ...x, stunden: x.stunden / teiler }));
}

/** Berechnet alle Belegungen (Herkunft B) für die geplanten Bereiche. */
export function berechneBelegungen(
  auftraege: AuftragPosition[],
  param: Parameter,
  stamm: Stammdaten,
  istArbeitstag: IstArbeitstag,
): Belegung[] {
  const offerteCodes = new Set(stamm.status.filter((s) => s.offerte).map((s) => s.code));
  const geplant = auftraege.filter((a) => stamm.geplanteBereiche.includes(a.bereich));
  const anzahl = new Map<string, number>();
  for (const a of geplant) {
    const k = `${a.auftrag_nr}|${a.bereich}`;
    anzahl.set(k, (anzahl.get(k) ?? 0) + 1);
  }
  const out: Belegung[] = [];
  for (const a of geplant) {
    const schritte = bedarfJeZeile(a, anzahl.get(`${a.auftrag_nr}|${a.bereich}`) ?? 1, param, stamm);
    const total = schritte.reduce((s, x) => s + x.stunden, 0);
    if (total <= 0) continue;
    const rate = a.bereich === 'Montage' ? param.montage_std_tag : param.produktion_std_tag;
    const tage = verteile(total, a.termin, a.dauer_tage, rate, istArbeitstag);
    for (const [datum, h] of tage) {
      const anteil = h / total;
      for (const s of schritte) {
        out.push({
          auftrag_nr: a.auftrag_nr,
          position: a.position,
          arbeitsschritt: s.arbeitsschritt,
          datum,
          stunden: s.stunden * anteil,
          bereich: a.bereich,
          maschinengruppe: s.maschinengruppe,
          offerte: offerteCodes.has(a.status),
        });
      }
    }
  }
  return out;
}
