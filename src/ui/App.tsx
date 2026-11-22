import { startTransition, useDeferredValue, useMemo, useState } from 'react';
import absenzenCsv from '../../testdata/absenzen.csv?raw';
import auftraegeCsv from '../../testdata/auftraege.csv?raw';
import maschinenCsv from '../../testdata/maschinen.csv?raw';
import mitarbeitendeCsv from '../../testdata/mitarbeitende.csv?raw';
import { berechne, type Ampel, type Periode } from '../calc/auslastung';
import { istGueltigesDatum, zuZahl } from '../calc/datum';
import { arbeitstagPruefer } from '../calc/kalender';
import { importiereDatei, LEERE_DATEN, type DateiBericht } from '../import/import';
import { ladeStammdaten, ladeStartparameter } from '../model/konfiguration';
import type { Daten } from '../model/typen';
import { Feinplanung } from './Feinplanung';
import { pz } from './format';
import { ImportBereich } from './ImportBereich';
import { WochenDiagramm } from './WochenDiagramm';

const stamm = ladeStammdaten();
const param = ladeStartparameter();

function ladeMitgelieferteTestdaten(): { daten: Daten; berichte: DateiBericht[] } {
  let daten = LEERE_DATEN;
  const berichte: DateiBericht[] = [];
  const dateien: [string, string][] = [
    ['mitarbeitende.csv', mitarbeitendeCsv],
    ['maschinen.csv', maschinenCsv],
    ['absenzen.csv', absenzenCsv],
    ['auftraege.csv', auftraegeCsv],
  ];
  for (const [name, text] of dateien) {
    const r = importiereDatei(`Testdaten: ${name}`, text, daten);
    daten = r.daten;
    berichte.push(r.bericht);
  }
  return { daten, berichte };
}

const heute = new Date().toISOString().slice(0, 10);

type Ansicht = 'grob' | 'fein' | 'daten';
const ANSICHTEN: { id: Ansicht; label: string; titel: string; untertitel: string }[] = [
  { id: 'grob', label: 'Grobplanung · 52 Wochen', titel: 'Grobplanung', untertitel: 'Stunden je Woche, 52 Wochen ab Stichtag' },
  { id: 'fein', label: 'Feinplanung · 2 Monate', titel: 'Feinplanung', untertitel: 'Stunden pro Arbeitstag, zwei Monate ab Stichtag. Tag im Kalender wählen.' },
  { id: 'daten', label: 'Daten', titel: 'Daten', untertitel: 'Geladene Daten und Import von CSV-Dateien' },
];

function auslastung4(wochen: Periode[], r: string): number | null {
  const n = wochen.slice(0, 4).map((w) => w.werte[r]);
  const v = n.reduce((s, x) => s + x.verfuegbar, 0);
  return v > 0 ? n.reduce((s, x) => s + x.geplant, 0) / v : null;
}
const status4 = (a: number | null): Ampel => (a === null ? 'frei' : a > 1 ? 'engpass' : a > param.warnschwelle ? 'knapp' : 'frei');

export function App() {
  const [start] = useState(ladeMitgelieferteTestdaten);
  const [daten, setDaten] = useState<Daten>(start.daten);
  const [berichte, setBerichte] = useState<DateiBericht[]>(start.berichte);
  const [stichtag, setStichtag] = useState(heute);
  const [zeigeOfferten, setZeigeOfferten] = useState(true);
  const [bereich, setBereich] = useState(stamm.geplanteBereiche[0]);
  const [ansicht, setAnsicht] = useState<Ansicht>('grob');

  // FA-10: nach jedem Import und jeder Änderung sofort neu berechnen
  // Stichtag: Eingabe sofort anzeigen, Neuberechnung erst bei gültigem Datum und zurückgestellt,
  // damit die Eingabe nie blockiert (z. B. Jahr 0002 während des Tippens).
  const [eingabe, setEingabe] = useState(heute);
  const stichtagBerechnung = useDeferredValue(stichtag);
  function stichtagEingabe(wert: string) {
    setEingabe(wert);
    const jahr = Number(wert.slice(0, 4));
    if (istGueltigesDatum(wert) && jahr >= 2000 && jahr <= 2100) startTransition(() => setStichtag(wert));
  }
  const ergebnis = useMemo(() => berechne(daten, param, stamm, stichtagBerechnung), [daten, stichtagBerechnung]);
  const istArbeitstag = useMemo(() => arbeitstagPruefer(daten.absenzen), [daten.absenzen]);

  async function importiere(dateien: FileList) {
    let d = daten;
    const neu: DateiBericht[] = [];
    for (const f of Array.from(dateien)) {
      const r = importiereDatei(f.name, await f.text(), d);
      d = r.daten;
      neu.push(r.bericht);
    }
    setDaten(d);
    setBerichte(neu);
  }

  const bereiche = stamm.geplanteBereiche;
  const engpass = bereiche.map((r) => ergebnis.wochen.filter((w) => w.werte[r].ampel === 'engpass'));
  const anzahlEngpass = engpass.reduce((s, l) => s + l.length, 0);
  const naechster = bereiche
    .map((r, i) => ({ r, w: engpass[i][0] }))
    .filter((x) => x.w)
    .sort((a, b) => zuZahl(a.w.datum) - zuZahl(b.w.datum))[0];
  const a = ANSICHTEN.find((x) => x.id === ansicht)!;

  return (
    <>
      <header className="kopfzeile">
        <div className="kopfzeile-innen">
          <span className="app-name">Planungstool Läng</span>
          <div className="segment" role="tablist" aria-label="Ansicht">
            {ANSICHTEN.map((x) => (
              <button key={x.id} role="tab" aria-selected={ansicht === x.id} className={ansicht === x.id ? 'an' : ''} onClick={() => setAnsicht(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
          <div className="steuerung">
            <label className="feld">
              <span>Stichtag</span>
              <input type="date" value={eingabe} min="2000-01-01" max="2100-12-31" onChange={(e) => stichtagEingabe(e.target.value)} />
            </label>
            <label className="schalter">
              <input type="checkbox" checked={zeigeOfferten} onChange={(e) => setZeigeOfferten(e.target.checked)} />
              <span className="schiene" aria-hidden />
              Offerten zeigen
            </label>
          </div>
        </div>
      </header>

      <main>
        <div className="seitenkopf">
          <h1>{a.titel}</h1>
          <p className="hilfe">{a.untertitel}</p>
        </div>

        {ansicht !== 'daten' && (
          <section className="kennzahlen">
            {bereiche.map((r) => {
              const x = auslastung4(ergebnis.wochen, r);
              return (
                <div key={r} className="karte kennzahl-karte">
                  <span className="kennzahl-label">Auslastung {r}</span>
                  <span className="kennzahl-wert">{pz(x)}</span>
                  <span className={`kennzahl-status ${status4(x)}`}>nächste 4 Wochen</span>
                </div>
              );
            })}
            <div className="karte kennzahl-karte">
              <span className="kennzahl-label">Engpasswochen</span>
              <span className="kennzahl-wert">{anzahlEngpass}</span>
              <span className="hilfe">{bereiche.map((r, i) => `${engpass[i].length} ${r}`).join(', ')}</span>
            </div>
            <div className="karte kennzahl-karte">
              <span className="kennzahl-label">Nächster Engpass</span>
              <span className="kennzahl-wert">{naechster ? naechster.w.label.split('/')[0] : 'keiner'}</span>
              <span className="hilfe">
                {naechster ? `${naechster.r}, ab ${new Date(`${naechster.w.datum}T12:00:00Z`).toLocaleDateString('de-CH')}` : 'in den nächsten 52 Wochen'}
              </span>
            </div>
          </section>
        )}

        {ansicht === 'grob' && (
          <section className="karte">
            <div className="karte-kopf">
              <div>
                <h2>{bereich}: Stunden je Woche</h2>
                <p className="hilfe">Über eine Woche fahren für Details.</p>
              </div>
              <div className="segment klein" role="tablist" aria-label="Bereich">
                {bereiche.map((r) => (
                  <button key={r} role="tab" aria-selected={r === bereich} className={r === bereich ? 'an' : ''} onClick={() => setBereich(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <WochenDiagramm key={bereich} ressource={bereich} wochen={ergebnis.wochen} zeigeOfferten={zeigeOfferten} />
            <div className="legende">
              <span><i className="marke frei" /> geplant</span>
              {zeigeOfferten && <span><i className="marke frei hell" /> Offerten, zählen nicht</span>}
              <span><i className="strich" /> verfügbar</span>
              <span><i className="marke knapp" /> ▲ knapp ab 90 %</span>
              <span><i className="marke engpass" /> ✖ Engpass über 100 %</span>
            </div>
          </section>
        )}

        {ansicht === 'fein' && (
          <Feinplanung ergebnis={ergebnis} daten={daten} param={param} stamm={stamm} stichtag={stichtagBerechnung}
            istArbeitstag={istArbeitstag} zeigeOfferten={zeigeOfferten} />
        )}

        {ansicht === 'daten' && <ImportBereich berichte={berichte} daten={daten} onDateien={importiere} />}
      </main>
    </>
  );
}
