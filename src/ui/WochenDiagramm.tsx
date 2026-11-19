import { useState } from 'react';
import type { Ampel, Periode } from '../calc/auslastung';
import { f1, pz } from './format';

const B = 20; // Breite je Woche
const H = 240; // Höhe Zeichenfläche
const OBEN = 12;
const LINKS = 40;
const STREIFEN = 18; // Höhe Ampelstreifen
const SYMBOL: Record<Ampel, string> = { frei: '', knapp: '▲', engpass: '✖' };
const AMPEL_TEXT: Record<Ampel, string> = { frei: 'frei', knapp: 'knapp', engpass: 'Engpass' };

function schoeneSkala(max: number): number[] {
  const roh = max / 4;
  const p = 10 ** Math.floor(Math.log10(roh));
  const schritt = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= roh) ?? roh;
  return [0, 1, 2, 3, 4].map((i) => i * schritt);
}

interface Props {
  ressource: string;
  wochen: Periode[];
  zeigeOfferten: boolean;
}

export function WochenDiagramm({ ressource, wochen, zeigeOfferten }: Props) {
  const [aktiv, setAktiv] = useState<number | null>(null);
  const werte = wochen.map((w) => w.werte[ressource]);
  const max = Math.max(1, ...werte.map((v) => Math.max(v.verfuegbar, v.geplant + (zeigeOfferten ? v.offerte : 0))));
  const ticks = schoeneSkala(max);
  const skala = ticks[ticks.length - 1];
  const y = (h: number) => OBEN + H - (h / skala) * H;
  const breite = LINKS + wochen.length * B + 4;
  const hoehe = OBEN + H + 8 + STREIFEN + 22;
  const streifenY = OBEN + H + 8;

  // Kapazität als durchgehende Stufenlinie
  const linie = werte
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${LINKS + i * B},${y(v.verfuegbar)} H${LINKS + (i + 1) * B}`)
    .join(' ');

  const idx = aktiv ?? Math.max(0, werte.findIndex((v) => v.ampel === 'engpass'));
  const w = wochen[idx];
  const v = werte[idx];
  const mitOff = v.verfuegbar > 0 ? (v.geplant + v.offerte) / v.verfuegbar : null;

  return (
    <div className="diagramm">
      <div className="detail" aria-live="polite">
        <div className="detail-kopf">
          <strong>{w.label}</strong>
          <span className="leise">ab {new Date(w.datum).toLocaleDateString('de-CH')}</span>
          <span className={`pille ${v.ampel}`}>{SYMBOL[v.ampel]} {AMPEL_TEXT[v.ampel]}</span>
        </div>
        <dl>
          <div><dt>Auslastung</dt><dd className="gross">{pz(v.auslastung)}</dd></div>
          <div><dt>geplant</dt><dd>{f1(v.geplant)} h</dd></div>
          <div><dt>verfügbar</dt><dd>{f1(v.verfuegbar)} h</dd></div>
          {zeigeOfferten && (
            <div><dt>mit Offerten</dt><dd>{f1(v.geplant + v.offerte)} h · {pz(mitOff)}</dd></div>
          )}
        </dl>
      </div>

      <div className="scroll">
        <svg viewBox={`0 0 ${breite} ${hoehe}`} role="img" aria-label={`Stunden je Woche ${ressource}`} onMouseLeave={() => setAktiv(null)}>
          <defs>
            <pattern id={`schraffur-${ressource}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="var(--offerte-grund)" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--offerte)" strokeWidth="2" />
            </pattern>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={LINKS} x2={breite} y1={y(t)} y2={y(t)} className="raster" />
              <text x={LINKS - 8} y={y(t) + 4} textAnchor="end" className="achse">{f1(t)}</text>
            </g>
          ))}

          {wochen.map((wo, i) => {
            const x = LINKS + i * B;
            const vv = werte[i];
            const oben = y(vv.geplant);
            return (
              <g key={wo.datum} onMouseEnter={() => setAktiv(i)} onClick={() => setAktiv(i)}>
                <rect x={x} y={OBEN} width={B} height={H + 8 + STREIFEN} className={`spalte ${i === idx ? 'aktiv' : ''}`} />
                <rect x={x + 3} y={oben} width={B - 6} height={OBEN + H - oben} rx={2} className={`balken ${vv.ampel}`} />
                {zeigeOfferten && vv.offerte > 0 && (
                  <rect x={x + 3} y={y(vv.geplant + vv.offerte)} width={B - 6} height={oben - y(vv.geplant + vv.offerte)}
                    fill={`url(#schraffur-${ressource})`} className="offerte" />
                )}
                <rect x={x + 1} y={streifenY} width={B - 2} height={STREIFEN} rx={3} className={`streifen ${vv.ampel}`} />
                {SYMBOL[vv.ampel] && (
                  <text x={x + B / 2} y={streifenY + 13} textAnchor="middle" className="streifen-symbol">{SYMBOL[vv.ampel]}</text>
                )}
                {i % 4 === 0 && (
                  <text x={x + B / 2} y={hoehe - 4} textAnchor="middle" className="achse">{wo.label.replace('KW ', '')}</text>
                )}
              </g>
            );
          })}
          <path d={linie} className="verfuegbar" />
        </svg>
      </div>
    </div>
  );
}
