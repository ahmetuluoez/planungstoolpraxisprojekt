// Feinplanung (FA-12): Stunden pro Tag, zwei Monate ab Stichtag, eine Spalte pro Arbeitstag.
// Nur Anzeige: die Werte kommen unverändert aus der Berechnung (calc/auslastung.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ampel, type Ampel, type Ergebnis } from '../calc/auslastung';
import { istWerktag, kalenderwoche } from '../calc/datum';
import type { IstArbeitstag } from '../calc/kalender';
import type { Daten, Parameter, Stammdaten } from '../model/typen';

const SYMBOL: Record<Ampel, string> = { frei: '✓', knapp: '▲', engpass: '✖' };
const AMPEL_TEXT: Record<Ampel, string> = { frei: 'frei', knapp: 'knapp', engpass: 'Engpass' };
// Eine Nachkommastelle mit Komma, z. B. «7,4»
const h1 = (x: number) => x.toFixed(1).replace('.', ',');
const pz = (x: number) => `${Math.round(x * 100)} %`;

interface Zeile {
  id: string;
  label: string;
  /** Ressource in der Berechnung: Bereich oder Maschinengruppe */
  ressource: string;
  /** Anteil an der Ressource. Annahme: Maschinen einer Gruppe teilen sich die Stunden nach Kapazität. */
  anteil: number;
  maschine: boolean;
}

interface Zelle {
  geplant: number;
  verfuegbar: number;
  offerte: number;
  ampel: Ampel;
  geschlossen: boolean;
}

interface Props {
  ergebnis: Ergebnis;
  daten: Daten;
  param: Parameter;
  stamm: Stammdaten;
  stichtag: string;
  istArbeitstag: IstArbeitstag;
  zeigeOfferten: boolean;
}

/** Letzter Tag des Zeitraums: zwei Monate ab Stichtag */
function zweiMonate(stichtag: string): string {
  const [j, m, t] = stichtag.split('-').map(Number);
  const ende = new Date(Date.UTC(j, m - 1 + 2, t - 1));
  return ende.toISOString().slice(0, 10);
}

export function Feinplanung({ ergebnis, daten, param, stamm, stichtag, istArbeitstag, zeigeOfferten }: Props) {
  const [auswahl, setAuswahl] = useState<{ zeile: string; datum: string } | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  // Auf schmalen Bildschirmen steht das Detail unter dem Raster: dann sichtbar machen
  useEffect(() => {
    if (auswahl && window.matchMedia('(max-width: 960px)').matches) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [auswahl]);

  const zeilen: Zeile[] = useMemo(() => {
    const bereiche = stamm.geplanteBereiche.map((b) => ({ id: b, label: b, ressource: b, anteil: 1, maschine: false }));
    const maschinen = daten.maschinen.map((m) => {
      const gruppe = daten.maschinen.filter((x) => x.maschinengruppe === m.maschinengruppe);
      const summe = gruppe.reduce((s, x) => s + x.kapazitaet_tag, 0);
      return {
        id: m.maschine_id,
        label: m.bezeichnung || m.maschine_id,
        ressource: m.maschinengruppe,
        anteil: summe > 0 ? m.kapazitaet_tag / summe : 1 / gruppe.length,
        maschine: true,
      };
    });
    return [...bereiche, ...maschinen];
  }, [daten.maschinen, stamm]);

  const bis = zweiMonate(stichtag);
  const tage = ergebnis.tage.filter((t) => t.datum >= stichtag && t.datum <= bis && istWerktag(t.datum));

  const tagMap = useMemo(() => new Map(ergebnis.tage.map((t) => [t.datum, t])), [ergebnis]);
  const zelle = (z: Zeile, datum: string): Zelle => {
    const p = tagMap.get(datum)!;
    const v = p.werte[z.ressource];
    const verfuegbar = v.verfuegbar * z.anteil;
    const geplant = v.geplant * z.anteil;
    const offerte = v.offerte * z.anteil;
    return { verfuegbar, geplant, offerte, ampel: ampel(geplant, verfuegbar, param.warnschwelle), geschlossen: !istArbeitstag(datum) };
  };

  // Belegungen je Tag, für das Detail (FA-15)
  const jeTag = useMemo(() => {
    const m = new Map<string, typeof ergebnis.belegungen>();
    for (const b of ergebnis.belegungen) {
      const l = m.get(b.datum);
      if (l) l.push(b); else m.set(b.datum, [b]);
    }
    return m;
  }, [ergebnis]);
  const auftragInfo = useMemo(() => new Map(daten.auftraege.map((a) => [a.auftrag_nr, a])), [daten.auftraege]);
  // Kurzform für die schmale Liste, z. B. «Auftrag bestätigt»
  const statusText = new Map(stamm.status.map((s) => [s.code, s.bezeichnung.split(',')[0]]));

  // Wochengruppen für die Kopfzeile
  const wochen: { label: string; anzahl: number }[] = [];
  for (const t of tage) {
    const { kw } = kalenderwoche(t.datum);
    const letzte = wochen[wochen.length - 1];
    if (letzte?.label === `KW ${kw}`) letzte.anzahl++;
    else wochen.push({ label: `KW ${kw}`, anzahl: 1 });
  }

  const gewaehlt = auswahl && zeilen.find((z) => z.id === auswahl.zeile);
  const detail = gewaehlt && auswahl ? (() => {
    const z = gewaehlt;
    const c = zelle(z, auswahl.datum);
    const sammel = new Map<string, { stunden: number; offerte: boolean }>();
    for (const b of jeTag.get(auswahl.datum) ?? []) {
      const passt = z.maschine ? b.maschinengruppe === z.ressource : b.bereich === z.ressource;
      if (!passt || (b.offerte && !zeigeOfferten)) continue;
      const k = b.auftrag_nr;
      const s = sammel.get(k) ?? { stunden: 0, offerte: b.offerte };
      s.stunden += b.stunden * z.anteil;
      sammel.set(k, s);
    }
    const liste = [...sammel.entries()]
      .map(([nr, s]) => ({ nr, ...s, a: auftragInfo.get(nr) }))
      .sort((a, b) => Number(a.offerte) - Number(b.offerte) || b.stunden - a.stunden);
    return { z, c, liste };
  })() : null;

  const datumLang = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className={`fein ${detail ? 'mit-detail' : ''}`}>
      <div className="fein-raster">
        <table className="raster-tabelle">
          <thead>
            <tr>
              <th className="kopf-zeile" rowSpan={2}>Ressource</th>
              {wochen.map((w, i) => <th key={i} colSpan={w.anzahl} className="kw">{w.label}</th>)}
            </tr>
            <tr>
              {tage.map((t) => {
                const d = new Date(`${t.datum}T12:00:00Z`);
                return (
                  <th key={t.datum} className={`tag ${istArbeitstag(t.datum) ? '' : 'zu'}`}>
                    <span className="wt">{d.toLocaleDateString('de-CH', { weekday: 'short' })}</span>
                    <span>{d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z, zi) => (
              <tr key={z.id} className={z.maschine && !zeilen[zi - 1]?.maschine ? 'trenn' : ''}>
                <th className="kopf-zeile">
                  {z.label}
                  {z.maschine && <span className="hilfe klein">{z.id}</span>}
                </th>
                {tage.map((t) => {
                  const c = zelle(z, t.datum);
                  const an = auswahl?.zeile === z.id && auswahl.datum === t.datum;
                  if (c.geschlossen) {
                    return (
                      <td key={t.datum} className="zelle geschlossen" title="Feiertag oder Betriebsferien">
                        <span className="wert">0,0 h</span>
                        <span className="pz">geschlossen</span>
                      </td>
                    );
                  }
                  const ausl = c.verfuegbar > 0 ? pz(c.geplant / c.verfuegbar) : c.geplant > 0 ? 'keine Kap.' : '0 %';
                  return (
                    <td key={t.datum} className={`zelle ${c.ampel} ${an ? 'an' : ''}`}>
                      <button
                        onClick={() => setAuswahl(an ? null : { zeile: z.id, datum: t.datum })}
                        title={`${z.label}, ${t.datum}: ${h1(c.geplant)} von ${h1(c.verfuegbar)} h, ${AMPEL_TEXT[c.ampel]}`}
                      >
                        <span className="wert">{h1(c.geplant)} / {h1(c.verfuegbar)} h</span>
                        <span className="pz"><span className="sym">{SYMBOL[c.ampel]}</span> {ausl}</span>
                        {zeigeOfferten && c.offerte > 0.05 && <span className="off">+{h1(c.offerte)} h Offerte</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hilfe fusszeile">
          Wochenenden ausgeblendet, Feiertage und Betriebsferien grau.
          Annahme: Bearbeitungscenter M1 und M2 teilen sich die Stunden der Gruppe BC nach Kapazität.
        </p>
      </div>

      {detail && (
        <aside className="detail-seite" ref={detailRef}>
          <div className="detail-titel">
            <div>
              <h3>{detail.z.label}</h3>
              <p className="hilfe">{datumLang(auswahl!.datum)}</p>
            </div>
            <button className="schliessen" onClick={() => setAuswahl(null)} aria-label="Detail schliessen">×</button>
          </div>
          <div className={`detail-ampel ${detail.c.ampel}`}>
            <span>{SYMBOL[detail.c.ampel]} {AMPEL_TEXT[detail.c.ampel]}</span>
            <strong>{h1(detail.c.geplant)} / {h1(detail.c.verfuegbar)} h</strong>
          </div>
          {detail.liste.length === 0 ? (
            <p className="hilfe">Keine Aufträge an diesem Tag.</p>
          ) : (
            <table className="auftrag-liste">
              <thead><tr><th>Auftrag</th><th>Projektart</th><th>Status</th><th className="r">Std.</th></tr></thead>
              <tbody>
                {detail.liste.map((x) => (
                  <tr key={x.nr} className={x.offerte ? 'ist-offerte' : ''}>
                    <td className="nr">{x.nr}</td>
                    <td>{x.a?.projektart}</td>
                    <td>{x.offerte ? 'Offerte, zählt nicht' : statusText.get(x.a?.status ?? '') ?? x.a?.status}</td>
                    <td className="r">{h1(x.stunden)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </aside>
      )}
    </div>
  );
}
