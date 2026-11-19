import { useState } from 'react';
import type { Ampel, Periode } from '../calc/auslastung';
import { f1, pz } from './format';

const B = 20; // Breite je Woche
const H = 260; // Höhe Zeichenfläche
const OBEN = 18;
const LINKS = 40;
const UNTEN = 26;
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
  const hoehe = OBEN + H + UNTEN;

  // Kapazität als durchgehende Stufenlinie
  const linie = werte
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${LINKS + i * B},${y(v.verfuegbar)} H${LINKS + (i + 1) * B}`)
    .join(' ');

  const tip = aktiv !== null ? { w: wochen[aktiv], v: werte[aktiv] } : null;
  const tipLinks = aktiv !== null ? ((LINKS + aktiv * B + B / 2) / breite) * 100 : 0;

  return (
    <div className="chart-scroll">
      <div className="chart-innen" onMouseLeave={() => setAktiv(null)}>
        <svg viewBox={`0 0 ${breite} ${hoehe}`} role="img" aria-label={`Stunden je Woche ${ressource}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LINKS} x2={breite} y1={y(t)} y2={y(t)} className="gitter" />
              <text x={LINKS - 8} y={y(t) + 3.5} textAnchor="end" className="achse">{f1(t)}</text>
            </g>
          ))}

          {wochen.map((wo, i) => {
            const x = LINKS + i * B;
            const vv = werte[i];
            const oben = y(vv.geplant);
            const offOben = y(vv.geplant + vv.offerte);
            const zeigeOff = zeigeOfferten && vv.offerte > 0 && oben - offOben > 1;
            return (
              <g key={wo.datum} onMouseEnter={() => setAktiv(i)} onFocus={() => setAktiv(i)} tabIndex={0}
                className={`woche ${aktiv === i ? 'aktiv' : ''}`}>
                <rect x={x} y={OBEN} width={B} height={H} className="spalte" />
                {vv.geplant > 0 && (
                  <rect x={x + 4} y={oben} width={B - 8} height={Math.max(1, OBEN + H - oben)} rx={3} className={`balken ${vv.ampel}`} />
                )}
                {zeigeOff && (
                  <rect x={x + 4} y={offOben} width={B - 8} height={Math.max(1, oben - offOben - 1.5)} rx={3} className={`balken hell ${vv.ampel}`} />
                )}
                {SYMBOL[vv.ampel] && (
                  <text x={x + B / 2} y={Math.min(zeigeOff ? offOben : oben, y(vv.verfuegbar)) - 5} textAnchor="middle" className={`symbol ${vv.ampel}`}>
                    {SYMBOL[vv.ampel]}
                  </text>
                )}
                {i % 4 === 0 && (
                  <text x={x + B / 2} y={hoehe - 6} textAnchor="middle" className="achse">{wo.label.replace('KW ', '')}</text>
                )}
              </g>
            );
          })}
          <path d={linie} className="kapazitaet" />
        </svg>

        {tip && (
          <div className={`tooltip ${tipLinks > 70 ? 'links' : ''}`} style={{ left: `${tipLinks}%` }} role="tooltip">
            <div className="tooltip-kopf">
              <strong>{tip.w.label}</strong>
              <span className={`status-pille ${tip.v.ampel}`}>{SYMBOL[tip.v.ampel] || '✓'} {AMPEL_TEXT[tip.v.ampel]}</span>
            </div>
            <div className="tooltip-zahl">{pz(tip.v.auslastung)}</div>
            <dl>
              <dt>geplant</dt><dd>{f1(tip.v.geplant)} h</dd>
              <dt>verfügbar</dt><dd>{f1(tip.v.verfuegbar)} h</dd>
              {zeigeOfferten && <><dt>Offerten</dt><dd>{f1(tip.v.offerte)} h</dd></>}
            </dl>
            {zeigeOfferten && tip.v.offerte > 0 && (
              <p className="tooltip-hinweis">
                Mit Offerten {tip.v.verfuegbar > 0 ? pz((tip.v.geplant + tip.v.offerte) / tip.v.verfuegbar) : 'keine Kapazität'}. Offerten zählen nicht.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
