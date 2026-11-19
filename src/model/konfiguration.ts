// Liest die Konfigurationsdateien und baut daraus Stammdaten und Startparameter.
import codetabellen from '../../config/codetabellen.json';
import startwerte from '../../config/parameter-startwerte.json';
import spalten from '../../config/spalten-triviso.json';
import type { Durchschnittswerte, Parameter, Stammdaten } from './typen';

export const spaltenTriviso = spalten;

export function ladeStammdaten(): Stammdaten {
  return {
    arbeitsschritte: codetabellen.arbeitsschritt,
    status: codetabellen.status,
    geplanteBereiche: codetabellen.bereich.filter((b) => b.geplant).map((b) => b.code),
    maschinengruppen: codetabellen.maschinengruppe.map((m) => m.code),
  };
}

export function ladeStartparameter(): Parameter {
  const dw: Durchschnittswerte = {};
  const { projektarten, werte } = startwerte.durchschnittswerte;
  projektarten.forEach((pa, i) => {
    dw[pa] = {};
    for (const [schritt, reihe] of Object.entries(werte)) dw[pa][schritt] = reihe[i] ?? 0;
  });
  return {
    durchschnittswerte: dw,
    montage_std_tag: startwerte.montage_std_tag,
    produktion_std_tag: startwerte.produktion_std_tag,
    materialvorlauf_tage: startwerte.materialvorlauf_tage,
    warnschwelle: startwerte.warnschwelle,
    bedarf_quelle: startwerte.bedarf_quelle === 'einsatz' ? 'einsatz' : 'durchschnittswert',
  };
}
