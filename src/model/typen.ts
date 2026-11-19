// Internes Datenmodell (Kapitel 7). Berechnung und Oberfläche kennen nur diese Typen (TA-03).
// Datum immer als Text JJJJ-MM-TT.

export type Datum = string;

/** Eine Zeile pro Position und Bereich (Annahme, offener Punkt 3). Herkunft T. */
export interface AuftragPosition {
  auftrag_nr: string;
  position: string;
  bezeichnung: string;
  projektart: string;
  status: string;
  bereich: string;
  termin: Datum;
  dauer_tage: number | null;
  einsatz_std: number | null;
}

/** Herkunft E. Anteile als Bruch (0 bis 1), in der Datei in Prozent. */
export interface Mitarbeitende {
  ma_id: string;
  name: string;
  pensum: number;
  /** Tagesstunden Mo bis Fr, Index 0 = Montag */
  std: [number, number, number, number, number];
  anteil_produktion: number;
  anteil_montage: number;
  lernend: boolean;
  lehrjahr: number | null;
}

/** Herkunft T. ma_id null = gilt für alle. stunden_pro_tag null = ganzer Tag. */
export interface Absenz {
  absenz_id: string;
  ma_id: string | null;
  von: Datum;
  bis: Datum;
  stunden_pro_tag: number | null;
  art: string;
}

/** Herkunft E. */
export interface Maschine {
  maschine_id: string;
  bezeichnung: string;
  maschinengruppe: string;
  kapazitaet_tag: number;
  personalbedarf_tag: number;
}

export interface Arbeitsschritt {
  code: string;
  bereich: string;
  maschinengruppe: string | null;
}

/** projektart -> arbeitsschritt -> stunden (PP-01) */
export type Durchschnittswerte = Record<string, Record<string, number>>;

export interface Parameter {
  durchschnittswerte: Durchschnittswerte;
  montage_std_tag: number;
  produktion_std_tag: number;
  materialvorlauf_tage: number;
  warnschwelle: number;
  bedarf_quelle: 'durchschnittswert' | 'einsatz';
}

export interface StatusCode {
  code: string;
  bezeichnung: string;
  offerte: boolean;
}

export interface Stammdaten {
  arbeitsschritte: Arbeitsschritt[];
  status: StatusCode[];
  /** Bereiche, die geplant werden (Produktion, Montage) */
  geplanteBereiche: string[];
  maschinengruppen: string[];
}

export interface Daten {
  auftraege: AuftragPosition[];
  mitarbeitende: Mitarbeitende[];
  absenzen: Absenz[];
  maschinen: Maschine[];
}

/** Herkunft B. */
export interface Belegung {
  auftrag_nr: string;
  position: string;
  arbeitsschritt: string;
  datum: Datum;
  stunden: number;
  bereich: string;
  maschinengruppe: string | null;
  offerte: boolean;
}
