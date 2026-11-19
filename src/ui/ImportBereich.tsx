import type { DateiBericht } from '../import/import';
import type { Daten } from '../model/typen';

const NAMEN = { auftraege: 'Aufträge', mitarbeitende: 'Mitarbeitende', absenzen: 'Absenzen', maschinen: 'Maschinen' };

interface Props {
  berichte: DateiBericht[];
  daten: Daten;
  onDateien: (dateien: FileList) => void;
}

export function ImportBereich({ berichte, daten, onDateien }: Props) {
  const quelle = berichte.every((b) => b.datei.startsWith('Testdaten')) ? 'Mitgelieferte Testdaten' : 'Importierte Dateien';
  const bestand: [string, number][] = [
    ['Auftragszeilen', daten.auftraege.length],
    ['Mitarbeitende', daten.mitarbeitende.length],
    ['Absenzen', daten.absenzen.length],
    ['Maschinen', daten.maschinen.length],
  ];
  return (
    <>
      <section className="kennzahlen">
        {bestand.map(([name, n]) => (
          <div key={name} className="karte kennzahl-karte">
            <span className="kennzahl-label">{name}</span>
            <span className="kennzahl-wert">{n.toLocaleString('de-CH')}</span>
          </div>
        ))}
      </section>

      <section className="karte">
        <div className="karte-kopf">
          <div>
            <h2>Import</h2>
            <p className="hilfe">Aktuelle Quelle: {quelle}. Änderungen gelten nur für diese Sitzung.</p>
          </div>
        </div>
        <label className="ablage">
          <input type="file" accept=".csv,text/csv" multiple onChange={(e) => e.target.files && onDateien(e.target.files)} />
          <span className="knopf-primaer">CSV-Dateien wählen</span>
          <span className="hilfe">UTF-8, Semikolon, Datum JJJJ-MM-TT. Die Datenart wird an der Kopfzeile erkannt und ersetzt nur die Daten dieser Art.</span>
        </label>
      </section>

      <section className="karte">
        <h2>Letzter Import</h2>
        <table className="liste">
          <thead>
            <tr><th>Datei</th><th>Datenart</th><th className="r">gelesen</th><th>Fehler</th></tr>
          </thead>
          <tbody>
            {berichte.map((b) => (
              <tr key={b.datei}>
                <td>{b.datei}</td>
                <td>{b.datenart ? NAMEN[b.datenart] : 'unbekannt'}</td>
                <td className="r">{b.anzahl.toLocaleString('de-CH')}</td>
                <td>
                  {b.fehler.length === 0 ? <span className="hilfe">keine</span> : (
                    <details>
                      <summary className="t-engpass">{b.fehler.length} Zeilen</summary>
                      <ul>{b.fehler.slice(0, 50).map((f) => <li key={f.zeile}>Zeile {f.zeile}: {f.grund}</li>)}</ul>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
