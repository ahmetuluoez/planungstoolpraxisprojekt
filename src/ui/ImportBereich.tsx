import type { DateiBericht } from '../import/import';

const NAMEN = { auftraege: 'Aufträge', mitarbeitende: 'Mitarbeitende', absenzen: 'Absenzen', maschinen: 'Maschinen' };

interface Props {
  berichte: DateiBericht[];
  onDateien: (dateien: FileList) => void;
}

export function ImportBereich({ berichte, onDateien }: Props) {
  return (
    <section className="import">
      <h2>Import</h2>
      <p>
        CSV-Dateien (UTF-8, Semikolon, Datum JJJJ-MM-TT) wählen. Die Datenart wird an der Kopfzeile erkannt.
        Eine importierte Datei ersetzt die Daten dieser Art, die übrigen bleiben.
      </p>
      <input type="file" accept=".csv,text/csv" multiple onChange={(e) => e.target.files && onDateien(e.target.files)} />
      <table>
        <thead>
          <tr><th>Datei</th><th>Datenart</th><th>gelesen</th><th>Fehler</th></tr>
        </thead>
        <tbody>
          {berichte.map((b) => (
            <tr key={b.datei}>
              <td>{b.datei}</td>
              <td>{b.datenart ? NAMEN[b.datenart] : 'unbekannt'}</td>
              <td>{b.anzahl}</td>
              <td>
                {b.fehler.length === 0 ? 'keine' : (
                  <details>
                    <summary>{b.fehler.length} Zeilen</summary>
                    <ul>{b.fehler.slice(0, 50).map((f) => <li key={f.zeile}>Zeile {f.zeile}: {f.grund}</li>)}</ul>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
