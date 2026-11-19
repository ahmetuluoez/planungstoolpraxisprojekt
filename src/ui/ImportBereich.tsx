import type { DateiBericht } from '../import/import';
import type { Daten } from '../model/typen';

const NAMEN = { auftraege: 'Aufträge', mitarbeitende: 'Mitarbeitende', absenzen: 'Absenzen', maschinen: 'Maschinen' };

interface Props {
  berichte: DateiBericht[];
  daten: Daten;
  onDateien: (dateien: FileList) => void;
}

export function ImportBereich({ berichte, daten, onDateien }: Props) {
  const fehler = berichte.reduce((s, b) => s + b.fehler.length, 0);
  const quelle = berichte.every((b) => b.datei.startsWith('Testdaten')) ? 'Testdaten' : 'Importierte Dateien';
  return (
    <details className="panel import">
      <summary>
        <div>
          <h2>Daten</h2>
          <p className="leise">
            {quelle} · {daten.auftraege.length.toLocaleString('de-CH')} Auftragszeilen · {daten.mitarbeitende.length} Mitarbeitende
            · {daten.absenzen.length} Absenzen · {daten.maschinen.length} Maschinen
            {fehler > 0 && <span className="t-engpass"> · {fehler} fehlerhafte Zeilen</span>}
          </p>
        </div>
        <span className="knopf">CSV importieren</span>
      </summary>

      <div className="import-inhalt">
        <label className="ablage">
          <input type="file" accept=".csv,text/csv" multiple onChange={(e) => e.target.files && onDateien(e.target.files)} />
          <strong>CSV-Dateien wählen</strong>
          <span className="leise">UTF-8, Semikolon, Datum JJJJ-MM-TT. Die Datenart wird an der Kopfzeile erkannt und ersetzt nur die Daten dieser Art.</span>
        </label>
        <table>
          <thead>
            <tr><th>Datei</th><th>Datenart</th><th>gelesen</th><th>Fehler</th></tr>
          </thead>
          <tbody>
            {berichte.map((b) => (
              <tr key={b.datei}>
                <td>{b.datei}</td>
                <td>{b.datenart ? NAMEN[b.datenart] : 'unbekannt'}</td>
                <td>{b.anzahl.toLocaleString('de-CH')}</td>
                <td>
                  {b.fehler.length === 0 ? <span className="leise">keine</span> : (
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
      </div>
    </details>
  );
}
