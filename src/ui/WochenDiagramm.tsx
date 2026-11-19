import type { Ampel, Periode } from '../calc/auslastung';

const B = 18; // Breite je Woche
const H = 220; // Höhe Zeichenfläche
const OBEN = 24;
const UNTEN = 36;
const LINKS = 44;
const SYMBOL: Record<Ampel, string> = { frei: '', knapp: '▲', engpass: '✖' };

const f1 = (x: number) => x.toLocaleString('de-CH', { maximumFractionDigits: 1 });
const pz = (x: number | null) => (x === null ? 'keine Kapazität' : `${Math.round(x * 100)} %`);

interface Props {
  titel: string;
  ressource: string;
  wochen: Periode[];
  zeigeOfferten: boolean;
}

export function WochenDiagramm({ titel, ressource, wochen, zeigeOfferten }: Props) {
  const werte = wochen.map((w) => w.werte[ressource]);
  const max = Math.max(1, ...werte.map((v) => Math.max(v.verfuegbar, v.geplant + (zeigeOfferten ? v.offerte : 0))));
  const skala = Math.ceil(max / 100) * 100;
  const y = (h: number) => OBEN + H - (h / skala) * H;
  const breite = LINKS + wochen.length * B + 8;
  const engpaesse = wochen.filter((w) => w.werte[ressource].ampel === 'engpass').map((w) => w.label);
  const knapp = wochen.filter((w) => w.werte[ressource].ampel === 'knapp').map((w) => w.label);
  const mitOfferten = wochen
    .filter((w) => w.werte[ressource].ampel !== 'engpass' && w.werte[ressource].ampelMitOfferten === 'engpass')
    .map((w) => w.label);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * skala);

  return (
    <section className="diagramm">
      <h2>{titel}</h2>
      <div className="scroll">
        <svg viewBox={`0 0 ${breite} ${OBEN + H + UNTEN}`} role="img" aria-label={`Stunden je Woche ${titel}`}>
          <defs>
            <pattern id="schraffur" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--offerte-grund)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--offerte)" strokeWidth="3" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LINKS} x2={breite - 4} y1={y(t)} y2={y(t)} className="raster" />
              <text x={LINKS - 6} y={y(t) + 4} textAnchor="end" className="achse">{f1(t)}</text>
            </g>
          ))}
          {wochen.map((w, i) => {
            const v = w.werte[ressource];
            const x = LINKS + i * B;
            const oben = y(v.geplant);
            return (
              <g key={w.datum}>
                <title>
                  {`${w.label} (ab ${w.datum})\nverfügbar ${f1(v.verfuegbar)} h\ngeplant ${f1(v.geplant)} h, ${pz(v.auslastung)}\nOfferten ${f1(v.offerte)} h`}
                </title>
                <rect x={x} y={OBEN} width={B} height={H} className="treffer" />
                <rect x={x + 2} y={oben} width={B - 4} height={OBEN + H - oben} className={`balken ${v.ampel}`} />
                {zeigeOfferten && v.offerte > 0 && (
                  <rect x={x + 2} y={y(v.geplant + v.offerte)} width={B - 4} height={oben - y(v.geplant + v.offerte)} fill="url(#schraffur)" className="offerte" />
                )}
                <line x1={x} x2={x + B} y1={y(v.verfuegbar)} y2={y(v.verfuegbar)} className="verfuegbar" />
                {SYMBOL[v.ampel] && (
                  <text x={x + B / 2} y={Math.min(oben, y(v.verfuegbar)) - 4} textAnchor="middle" className={`symbol ${v.ampel}`}>
                    {SYMBOL[v.ampel]}
                  </text>
                )}
                {i % 4 === 0 && (
                  <text x={x + B / 2} y={OBEN + H + 16} textAnchor="middle" className="achse">{w.label.replace('KW ', '')}</text>
                )}
              </g>
            );
          })}
          <text x={LINKS} y={OBEN + H + 32} className="achse">Kalenderwoche</text>
          <text x={4} y={14} className="achse">Stunden</text>
        </svg>
      </div>
      <p className="hinweis">
        <strong>Engpass:</strong> {engpaesse.length ? engpaesse.join(', ') : 'keiner'}.{' '}
        <strong>Knapp:</strong> {knapp.length ? knapp.join(', ') : 'keine'}.
        {zeigeOfferten && mitOfferten.length > 0 && (
          <> <strong>Engpass bei Annahme aller Offerten:</strong> {mitOfferten.join(', ')}.</>
        )}
      </p>
    </section>
  );
}
