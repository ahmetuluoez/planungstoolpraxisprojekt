// Feinplanung (FA-12): Stunden pro Tag, zwei Monate ab Stichtag.
// Links ein Kalender zum Wählen des Tages, rechts gross alle Ressourcen und Aufträge dieses Tages (FA-15).
// Nur Anzeige: die Werte kommen unverändert aus der Berechnung (calc/auslastung.ts).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ampel, type Ampel, type Ergebnis } from '../calc/auslastung';
import { istWerktag, kalenderwoche, montagDerWoche, plusTage, tageZwischen } from '../calc/datum';
import type { IstArbeitstag } from '../calc/kalender';
import type { Daten, Parameter, Stammdaten } from '../model/typen';

const SYMBOL: Record<Ampel, string> = { frei: '✓', knapp: '▲', engpass: '✖' };
const AMPEL_TEXT: Record<Ampel, string> = { frei: 'frei', knapp: 'knapp', engpass: 'Engpass' };
const RANG: Record<Ampel, number> = { frei: 0, knapp: 1, engpass: 2 };
// Eine Nachkommastelle mit Komma, z. B. «7,4»
const h1 = (x: number) => x.toFixed(1).replace('.', ',');
const pz = (x: number) => `${Math.round(x * 100)} %`;
const alsDatum = (d: string) => new Date(`${d}T12:00:00Z`);

interface Zeile {
  id: string;
  label: string;
  kurz: string;
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
  return new Date(Date.UTC(j, m - 1 + 2, t - 1)).toISOString().slice(0, 10);
}

export function Feinplanung({ ergebnis, daten, param, stamm, stichtag, istArbeitstag, zeigeOfferten }: Props) {
  const bis = zweiMonate(stichtag);
  const werktage = useMemo(
    () => tageZwischen(stichtag, bis).filter(istWerktag),
    [stichtag, bis],
  );
  const erster = werktage.find(istArbeitstag) ?? werktage[0];
  const [gewaehlterTag, setTag] = useState(erster);
  const [zeileId, setZeileId] = useState<string>(stamm.geplanteBereiche[0]);
  const [markierung, setMarkierung] = useState<string>('alle');

  // Liegt der gewählte Tag nach einer Stichtagänderung nicht mehr im Zeitraum, gilt der erste Arbeitstag.
  // Im selben Render abgeleitet (nicht per useEffect), sonst fehlen für einen Render die Werte des Tages.
  const tag = werktage.includes(gewaehlterTag) ? gewaehlterTag : erster;

  const zeilen: Zeile[] = useMemo(() => {
    const bereiche = stamm.geplanteBereiche.map((b) => ({ id: b, label: b, kurz: b, ressource: b, anteil: 1, maschine: false }));
    const maschinen = daten.maschinen.map((m) => {
      const gruppe = daten.maschinen.filter((x) => x.maschinengruppe === m.maschinengruppe);
      const summe = gruppe.reduce((s, x) => s + x.kapazitaet_tag, 0);
      return {
        id: m.maschine_id,
        label: m.bezeichnung || m.maschine_id,
        kurz: m.maschine_id,
        ressource: m.maschinengruppe,
        anteil: summe > 0 ? m.kapazitaet_tag / summe : 1 / gruppe.length,
        maschine: true,
      };
    });
    return [...bereiche, ...maschinen];
  }, [daten.maschinen, stamm]);

  const tagMap = useMemo(() => new Map(ergebnis.tage.map((t) => [t.datum, t])), [ergebnis]);
  const zelle = (z: Zeile, datum: string): Zelle | null => {
    const p = tagMap.get(datum);
    if (!p) return null;
    const v = p.werte[z.ressource];
    const verfuegbar = v.verfuegbar * z.anteil;
    const geplant = v.geplant * z.anteil;
    return { verfuegbar, geplant, offerte: v.offerte * z.anteil, ampel: ampel(geplant, verfuegbar, param.warnschwelle) };
  };

  /** Status eines Tages im Kalender: gewählte Ressource oder die schlechteste aller Ressourcen */
  const tagesStatus = (datum: string): Ampel | null => {
    if (!istArbeitstag(datum)) return null;
    const auswahl = markierung === 'alle' ? zeilen : zeilen.filter((z) => z.id === markierung);
    let schlimmste: Ampel = 'frei';
    for (const z of auswahl) {
      const c = zelle(z, datum);
      if (c && RANG[c.ampel] > RANG[schlimmste]) schlimmste = c.ampel;
    }
    return schlimmste;
  };

  // Belegungen je Tag (FA-15)
  const jeTag = useMemo(() => {
    const m = new Map<string, typeof ergebnis.belegungen>();
    for (const b of ergebnis.belegungen) {
      const l = m.get(b.datum);
      if (l) l.push(b); else m.set(b.datum, [b]);
    }
    return m;
  }, [ergebnis]);
  const auftragInfo = useMemo(() => new Map(daten.auftraege.map((a) => [a.auftrag_nr, a])), [daten.auftraege]);
  const statusText = new Map(stamm.status.map((s) => [s.code, s.bezeichnung.split(',')[0]]));

  // Grund für geschlossene Tage (Feiertag, Betriebsferien) aus den Absenzen
  const schliessGrund = (datum: string) =>
    daten.absenzen.find((a) => a.ma_id === null && a.stunden_pro_tag === null && a.von <= datum && a.bis >= datum)?.art ?? 'Betrieb geschlossen';

  // Monate für den Kalender, je Woche Mo bis Fr
  const monate = useMemo(() => {
    const out: { titel: string; wochen: { kw: number; tage: (string | null)[] }[] }[] = [];
    let m = stichtag.slice(0, 7);
    while (m <= bis.slice(0, 7)) {
      const erster = `${m}-01`;
      const [j, mo] = m.split('-').map(Number);
      const letzter = new Date(Date.UTC(j, mo, 0)).toISOString().slice(0, 10);
      const wochen: { kw: number; tage: (string | null)[] }[] = [];
      for (let mon = montagDerWoche(erster); mon <= letzter; mon = plusTage(mon, 7)) {
        const tage = [0, 1, 2, 3, 4].map((i) => {
          const d = plusTage(mon, i);
          return d.slice(0, 7) === m ? d : null;
        });
        // nur Wochen mit mindestens einem Tag im Zeitraum, damit der Kalender kompakt bleibt
        if (tage.some((d) => d && d >= stichtag && d <= bis)) wochen.push({ kw: kalenderwoche(mon).kw, tage });
      }
      out.push({ titel: alsDatum(erster).toLocaleDateString('de-CH', { month: 'long', year: 'numeric' }), wochen });
      m = new Date(Date.UTC(j, mo, 1)).toISOString().slice(0, 7);
    }
    return out;
  }, [stichtag, bis]);

  const idx = werktage.indexOf(tag);
  // Stabil: hängt nur von den Werktagen ab, nicht vom gewählten Tag
  const blaettern = useCallback((schritt: number) => {
    setTag((t) => {
      const i = werktage.indexOf(t);
      if (i < 0) return werktage.find(istArbeitstag) ?? werktage[0];
      return werktage[i + schritt] ?? t;
    });
  }, [werktage, istArbeitstag]);
  // Pfeiltasten: Listener nur neu anmelden, wenn sich der Zeitraum ändert
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      if (e.key === 'ArrowRight') blaettern(1);
      if (e.key === 'ArrowLeft') blaettern(-1);
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [blaettern]);

  const offen = istArbeitstag(tag);
  const gewaehlt = zeilen.find((z) => z.id === zeileId) ?? zeilen[0];

  const auftraege = (() => {
    const sammel = new Map<string, { stunden: number; offerte: boolean }>();
    for (const b of jeTag.get(tag) ?? []) {
      const passt = gewaehlt.maschine ? b.maschinengruppe === gewaehlt.ressource : b.bereich === gewaehlt.ressource;
      if (!passt || (b.offerte && !zeigeOfferten)) continue;
      const s = sammel.get(b.auftrag_nr) ?? { stunden: 0, offerte: b.offerte };
      s.stunden += b.stunden * gewaehlt.anteil;
      sammel.set(b.auftrag_nr, s);
    }
    return [...sammel.entries()]
      .map(([nr, s]) => ({ nr, ...s, a: auftragInfo.get(nr) }))
      .sort((a, b) => Number(a.offerte) - Number(b.offerte) || b.stunden - a.stunden);
  })();

  return (
    <div className="kalender-layout">
      {/* Kalender links */}
      <aside className="karte kalender">
        <label className="markierung">
          <span className="hilfe">Ampel im Kalender</span>
          <select value={markierung} onChange={(e) => setMarkierung(e.target.value)}>
            <option value="alle">Alle Ressourcen (schlechteste)</option>
            {zeilen.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
          </select>
        </label>
        {monate.map((mo) => (
          <div key={mo.titel} className="monat">
            <h3>{mo.titel}</h3>
            <div className="monat-gitter">
              <span className="kw-kopf">KW</span>
              {['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((w) => <span key={w} className="wt-kopf">{w}</span>)}
              {mo.wochen.map((w) => (
                <div key={w.kw} className="woche-zeile">
                  <span className="kw-nr">{w.kw}</span>
                  {w.tage.map((d, i) => {
                    if (!d) return <span key={i} />;
                    const imBereich = d >= stichtag && d <= bis;
                    const st = imBereich ? tagesStatus(d) : null;
                    const zu = imBereich && !istArbeitstag(d);
                    return (
                      <button
                        key={d}
                        disabled={!imBereich}
                        onClick={() => {
                          setTag(d);
                          // Auf schmalen Bildschirmen steht das Detail unter dem Kalender
                          if (window.matchMedia('(max-width: 900px)').matches) {
                            requestAnimationFrame(() => document.querySelector('.tag-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                          }
                        }}
                        className={`kal-tag ${d === tag ? 'an' : ''} ${zu ? 'zu' : ''} ${st ?? ''}`}
                        aria-label={`${alsDatum(d).toLocaleDateString('de-CH')}${st ? `, ${AMPEL_TEXT[st]}` : zu ? ', geschlossen' : ''}`}
                      >
                        <span className="nr">{Number(d.slice(8))}</span>
                        <span className="sym">{st ? SYMBOL[st] : zu ? '–' : ''}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="kal-legende hilfe">
          <span><b className="frei">✓</b> frei</span>
          <span><b className="knapp">▲</b> knapp</span>
          <span><b className="engpass">✖</b> Engpass</span>
          <span><b>–</b> geschlossen</span>
        </div>
      </aside>

      {/* Tagesdetail rechts */}
      <section className="karte tag-detail">
        <div className="tag-kopf">
          <div>
            <h2 className="tag-titel">{alsDatum(tag).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
            <p className="hilfe">KW {kalenderwoche(tag).kw} · Pfeiltasten wechseln den Tag</p>
          </div>
          <div className="blaettern">
            <button onClick={() => blaettern(-1)} disabled={idx <= 0} aria-label="Vorheriger Tag">‹</button>
            <button onClick={() => blaettern(1)} disabled={idx >= werktage.length - 1} aria-label="Nächster Tag">›</button>
          </div>
        </div>

        {!offen ? (
          <div className="geschlossen-hinweis">
            <strong>{schliessGrund(tag)}</strong>
            <span className="hilfe">Betrieb geschlossen, 0,0 h verfügbar.</span>
          </div>
        ) : (
          <>
            <div className="ressourcen">
              {zeilen.map((z, i) => {
                const c = zelle(z, tag)!;
                const q = c.verfuegbar > 0 ? c.geplant / c.verfuegbar : c.geplant > 0 ? 2 : 0;
                const qOff = c.verfuegbar > 0 ? c.offerte / c.verfuegbar : 0;
                const max = 1.25;
                return (
                  <button
                    key={z.id}
                    className={`ressource ${z.id === gewaehlt.id ? 'an' : ''} ${z.maschine && !zeilen[i - 1]?.maschine ? 'erste-maschine' : ''}`}
                    onClick={() => setZeileId(z.id)}
                  >
                    <span className="r-name">
                      {z.label}
                      {z.maschine && <span className="hilfe klein"> {z.kurz}</span>}
                    </span>
                    <span className={`r-status ${c.ampel}`}>{SYMBOL[c.ampel]} {c.verfuegbar > 0 ? pz(q) : '–'}</span>
                    <span className="r-stunden">{h1(c.geplant)} / {h1(c.verfuegbar)} h</span>
                    <span className="r-balken" aria-hidden>
                      <span className={`fuell ${c.ampel}`} style={{ width: `${(Math.min(q, max) / max) * 100}%` }} />
                      {zeigeOfferten && qOff > 0 && (
                        <span className={`fuell hell ${c.ampel}`} style={{ width: `${(Math.min(qOff, max - Math.min(q, max)) / max) * 100}%` }} />
                      )}
                      <span className="grenze" style={{ left: `${(1 / max) * 100}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="hilfe fusszeile">
              Strich im Balken = 100 % der verfügbaren Stunden.{zeigeOfferten && ' Hellere Fläche = Offerten, zählen nicht.'}{' '}
              Annahme: Bearbeitungscenter M1 und M2 teilen sich die Stunden der Gruppe BC nach Kapazität.
            </p>

            <div className="auftraege-kopf">
              <h3>Aufträge {gewaehlt.label}</h3>
              <span className="hilfe">{auftraege.length} an diesem Tag</span>
            </div>
            {auftraege.length === 0 ? (
              <p className="hilfe">Keine Aufträge an diesem Tag.</p>
            ) : (
              <table className="liste">
                <thead><tr><th>Auftrag</th><th>Projektart</th><th>Status</th><th className="r">Stunden</th></tr></thead>
                <tbody>
                  {auftraege.map((x) => (
                    <tr key={x.nr} className={x.offerte ? 'ist-offerte' : ''}>
                      <td className="nr">{x.nr}</td>
                      <td>{x.a?.projektart}</td>
                      <td>{x.offerte ? 'Offerte, zählt nicht' : statusText.get(x.a?.status ?? '') ?? x.a?.status}</td>
                      <td className="r">{h1(x.stunden)} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </div>
  );
}
