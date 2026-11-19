import { useMemo, useState } from 'react';
import absenzenCsv from '../../testdata/absenzen.csv?raw';
import auftraegeCsv from '../../testdata/auftraege.csv?raw';
import maschinenCsv from '../../testdata/maschinen.csv?raw';
import mitarbeitendeCsv from '../../testdata/mitarbeitende.csv?raw';
import { berechne } from '../calc/auslastung';
import { importiereDatei, LEERE_DATEN, type DateiBericht } from '../import/import';
import { ladeStammdaten, ladeStartparameter } from '../model/konfiguration';
import type { Daten } from '../model/typen';
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

export function App() {
  const [start] = useState(ladeMitgelieferteTestdaten);
  const [daten, setDaten] = useState<Daten>(start.daten);
  const [berichte, setBerichte] = useState<DateiBericht[]>(start.berichte);
  const [stichtag, setStichtag] = useState(heute);
  const [zeigeOfferten, setZeigeOfferten] = useState(true);

  // FA-10: nach jedem Import und jeder Änderung sofort neu berechnen
  const ergebnis = useMemo(() => berechne(daten, param, stamm, stichtag), [daten, stichtag]);

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

  return (
    <main>
      <header>
        <h1>Planungstool Läng</h1>
        <p className="untertitel">Grobplanung: Stunden je Woche, 52 Wochen ab Stichtag</p>
      </header>

      <section className="steuerung">
        <label>
          Stichtag{' '}
          <input type="date" value={stichtag} onChange={(e) => e.target.value && setStichtag(e.target.value)} />
        </label>
        <label>
          <input type="checkbox" checked={zeigeOfferten} onChange={(e) => setZeigeOfferten(e.target.checked)} />{' '}
          Offerten anzeigen
        </label>
        <span className="info">
          {daten.auftraege.length} Auftragszeilen, {daten.mitarbeitende.length} Mitarbeitende,{' '}
          {daten.absenzen.length} Absenzen, {daten.maschinen.length} Maschinen
        </span>
      </section>

      <Legende />

      {stamm.geplanteBereiche.map((r) => (
        <WochenDiagramm key={r} titel={r} ressource={r} wochen={ergebnis.wochen} zeigeOfferten={zeigeOfferten} />
      ))}

      <ImportBereich berichte={berichte} onDateien={importiere} />
    </main>
  );
}

function Legende() {
  return (
    <div className="legende">
      <span><i className="kasten frei" /> frei (bis 90 %)</span>
      <span><i className="kasten knapp" /> ▲ knapp (90 bis 100 %)</span>
      <span><i className="kasten engpass" /> ✖ Engpass (über 100 %)</span>
      <span><i className="kasten offerte" /> Offerten (zählen nicht zur Auslastung)</span>
      <span><i className="linie" /> verfügbar</span>
    </div>
  );
}
