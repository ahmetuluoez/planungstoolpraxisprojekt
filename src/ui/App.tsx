import { useMemo, useState } from 'react';
import absenzenCsv from '../../testdata/absenzen.csv?raw';
import auftraegeCsv from '../../testdata/auftraege.csv?raw';
import maschinenCsv from '../../testdata/maschinen.csv?raw';
import mitarbeitendeCsv from '../../testdata/mitarbeitende.csv?raw';
import { berechne, type Periode } from '../calc/auslastung';
import { importiereDatei, LEERE_DATEN, type DateiBericht } from '../import/import';
import { ladeStammdaten, ladeStartparameter } from '../model/konfiguration';
import type { Daten } from '../model/typen';
import { pz } from './format';
import { arbeitstagPruefer } from '../calc/kalender';
import { Feinplanung } from './Feinplanung';
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

/** Kennzahlen für die Übersichtskarte eines Bereichs */
function kennzahlen(wochen: Periode[], r: string) {
  const naechste = wochen.slice(0, 4).map((w) => w.werte[r]);
  const v = naechste.reduce((s, x) => s + x.verfuegbar, 0);
  const g = naechste.reduce((s, x) => s + x.geplant, 0);
  const engpass = wochen.filter((w) => w.werte[r].ampel === 'engpass');
  const knapp = wochen.filter((w) => w.werte[r].ampel === 'knapp');
  return {
    auslastung4: v > 0 ? g / v : null,
    engpass: engpass.length,
    knapp: knapp.length,
    naechsterEngpass: engpass[0]?.label ?? null,
  };
}

export function App() {
  const [start] = useState(ladeMitgelieferteTestdaten);
  const [daten, setDaten] = useState<Daten>(start.daten);
  const [berichte, setBerichte] = useState<DateiBericht[]>(start.berichte);
  const [stichtag, setStichtag] = useState(heute);
  const [zeigeOfferten, setZeigeOfferten] = useState(true);
  const [bereich, setBereich] = useState(stamm.geplanteBereiche[0]);

  // FA-10: nach jedem Import und jeder Änderung sofort neu berechnen
  const ergebnis = useMemo(() => berechne(daten, param, stamm, stichtag), [daten, stichtag]);
  const istArbeitstag = useMemo(() => arbeitstagPruefer(daten.absenzen), [daten.absenzen]);
  const [ansicht, setAnsicht] = useState<'grob' | 'fein'>('grob');

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

  const k = kennzahlen(ergebnis.wochen, bereich);

  return (
    <>
      <header className="kopf">
        <div className="kopf-innen">
          <div>
            <h1>Planungstool Läng</h1>
            <p className="leise">{ansicht === 'grob' ? 'Grobplanung · 52 Wochen ab Stichtag' : 'Feinplanung · 2 Monate ab Stichtag'}</p>
          </div>
          <div className="umschalter" role="tablist" aria-label="Ansicht">
            <button role="tab" aria-selected={ansicht === 'grob'} className={ansicht === 'grob' ? 'an' : ''} onClick={() => setAnsicht('grob')}>
              Grobplanung · 52 Wochen
            </button>
            <button role="tab" aria-selected={ansicht === 'fein'} className={ansicht === 'fein' ? 'an' : ''} onClick={() => setAnsicht('fein')}>
              Feinplanung · 2 Monate
            </button>
          </div>
          <div className="steuerung">
            <label className="feld">
              <span>Stichtag</span>
              <input type="date" value={stichtag} onChange={(e) => e.target.value && setStichtag(e.target.value)} />
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
        <section className="karten">
          {stamm.geplanteBereiche.map((r) => {
            const x = kennzahlen(ergebnis.wochen, r);
            const status = x.engpass > 0 ? 'engpass' : x.knapp > 0 ? 'knapp' : 'frei';
            return (
              <button key={r} className={`karte ${r === bereich ? 'gewaehlt' : ''}`} onClick={() => setBereich(r)}>
                <div className="karte-kopf">
                  <h2>{r}</h2>
                  <span className={`punkt ${status}`} aria-hidden />
                </div>
                <div className="kennzahl">{pz(x.auslastung4)}</div>
                <div className="leise">Auslastung nächste 4 Wochen</div>
                <div className="karte-fuss">
                  <span><b className="t-engpass">{x.engpass}</b> Engpass</span>
                  <span><b className="t-knapp">{x.knapp}</b> knapp</span>
                  <span className="leise">{x.naechsterEngpass ? `nächster: ${x.naechsterEngpass}` : 'kein Engpass'}</span>
                </div>
              </button>
            );
          })}
        </section>

        {ansicht === 'fein' && (
          <section className="panel">
            <div className="panel-kopf">
              <div>
                <h2>Feinplanung: Stunden pro Tag</h2>
                <p className="leise">Geplant / verfügbar je Arbeitstag, zwei Monate ab Stichtag.</p>
              </div>
            </div>
            <Feinplanung ergebnis={ergebnis} daten={daten} param={param} stamm={stamm} stichtag={stichtag}
              istArbeitstag={istArbeitstag} zeigeOfferten={zeigeOfferten} />
          </section>
        )}

        {ansicht === 'grob' && <section className="panel">
          <div className="panel-kopf">
            <div>
              <h2>{bereich}: Stunden je Woche</h2>
              <p className="leise">
                {k.engpass > 0
                  ? `${k.engpass} Wochen mit Engpass. Fahre über eine Woche für Details.`
                  : 'Keine Engpässe. Fahre über eine Woche für Details.'}
              </p>
            </div>
            <div className="umschalter" role="tablist">
              {stamm.geplanteBereiche.map((r) => (
                <button key={r} role="tab" aria-selected={r === bereich} className={r === bereich ? 'an' : ''} onClick={() => setBereich(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <WochenDiagramm key={bereich} ressource={bereich} wochen={ergebnis.wochen} zeigeOfferten={zeigeOfferten} />

          <div className="legende">
            <span><i className="kasten geplant" /> geplant</span>
            <span><i className="linie" /> verfügbar</span>
            {zeigeOfferten && <span><i className="kasten offerte" /> Offerten (zählen nicht)</span>}
            <span className="trenner" />
            <span><i className="kasten frei" /> frei bis 90 %</span>
            <span><i className="kasten knapp" /> ▲ knapp 90 bis 100 %</span>
            <span><i className="kasten engpass" /> ✖ Engpass über 100 %</span>
          </div>
        </section>}

        <ImportBereich berichte={berichte} daten={daten} onDateien={importiere} />
      </main>
    </>
  );
}
