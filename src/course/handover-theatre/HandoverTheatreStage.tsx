import type { ReactElement } from 'react';

import { SixActsSubtitleBar } from '../nav/SixActsAnnotation';
import type { SixActsPhasePlan } from '../sixActs/directorScript';

/**
 * The stage: two links, their elevations, and the rule drawn as a rule.
 *
 * Deliberately 2D. The geometry Act 4 teaches is "who is higher, who is
 * falling, and did the gap hold long enough" — a schematic says that in one
 * glance, and a globe would bury it.
 */

export interface HandoverTheatreStageProps {
  readonly phase: SixActsPhasePlan | null;
  readonly servingElevationDeg: number;
  readonly candidateElevationDeg: number;
  readonly servingName: string;
  readonly candidateName: string;
  readonly committed: boolean;
  readonly tttProgressSec: number;
  readonly tttTotalSec: number;
  readonly offsetDb: number;
  readonly deltaDb: number;
}

function skyY(elevationDeg: number, height: number): number {
  return height - (Math.max(0, Math.min(90, elevationDeg)) / 90) * height;
}

export function HandoverTheatreStage({
  phase, servingElevationDeg, candidateElevationDeg, servingName, candidateName,
  committed, tttProgressSec, tttTotalSec, offsetDb, deltaDb,
}: HandoverTheatreStageProps): ReactElement {
  const width = 720;
  const height = 300;
  const ueX = width / 2;
  const ueY = height - 18;

  const servingX = width * 0.22;
  const candidateX = width * 0.78;
  const servingY = skyY(servingElevationDeg, height - 60);
  const candidateY = skyY(candidateElevationDeg, height - 60);

  const showCandidate = phase === null || phase.requiresVisible.includes('to');
  const conditionArmed = phase?.id === 'D-condition' || phase?.id === 'E-execute';
  const tttFraction = tttTotalSec === 0 ? 0 : tttProgressSec / tttTotalSec;

  return (
    <div className="theatre__stage">
      <svg viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`服務衛星仰角 ${servingElevationDeg.toFixed(1)} 度，候選 ${candidateElevationDeg.toFixed(1)} 度`}>
        <line x1={0} x2={width} y1={ueY} y2={ueY} className="theatre__horizon" />
        <text x={10} y={ueY - 6} className="theatre__axis-label">地平線</text>

        {/* the served link, and the one that replaces it */}
        <line x1={ueX} x2={servingX} y1={ueY} y2={servingY}
          className={committed ? 'theatre__link is-dropped' : 'theatre__link is-serving'} />
        {showCandidate ? (
          <line x1={ueX} x2={candidateX} y1={ueY} y2={candidateY}
            className={committed ? 'theatre__link is-serving' : 'theatre__link is-candidate'} />
        ) : null}

        <circle cx={ueX} cy={ueY} r={7} className="theatre__ue" />
        <text x={ueX} y={ueY + 16} className="theatre__ue-label" textAnchor="middle">NTPU</text>

        <g className={committed ? 'theatre__sat is-dropped' : 'theatre__sat is-serving'}>
          <rect x={servingX - 16} y={servingY - 8} width={32} height={16} rx={3} />
          <text x={servingX} y={servingY - 16} textAnchor="middle">{servingName}</text>
          <text x={servingX} y={servingY + 26} textAnchor="middle" className="theatre__sat-elev">
            {servingElevationDeg.toFixed(1)}°
          </text>
        </g>

        {showCandidate ? (
          <g className={committed ? 'theatre__sat is-serving' : 'theatre__sat is-candidate'}>
            <rect x={candidateX - 16} y={candidateY - 8} width={32} height={16} rx={3} />
            <text x={candidateX} y={candidateY - 16} textAnchor="middle">{candidateName}</text>
            <text x={candidateX} y={candidateY + 26} textAnchor="middle" className="theatre__sat-elev">
              {candidateElevationDeg.toFixed(1)}°
            </text>
          </g>
        ) : null}

        {conditionArmed ? (
          <g className="theatre__rule">
            <rect x={width / 2 - 130} y={16} width={260} height={54} rx={8} />
            <text x={width / 2} y={38} textAnchor="middle">
              候選 − 服務 = {deltaDb.toFixed(2)} dB ＞ {offsetDb} dB
            </text>
            <text x={width / 2} y={58} textAnchor="middle" className="theatre__rule-ttt">
              且持續 {tttProgressSec.toFixed(0)} / {tttTotalSec} 秒
            </text>
            <rect x={width / 2 - 120} y={62} width={240} height={4} rx={2} className="theatre__ttt-track" />
            <rect x={width / 2 - 120} y={62} width={240 * tttFraction} height={4} rx={2} className="theatre__ttt-fill" />
          </g>
        ) : null}
      </svg>

      {/* One subtitle band UNDER the stage. The earlier version floated cards
          over the middle of the scene and hid the geometry being narrated. */}
      {phase === null ? null : (
        <SixActsSubtitleBar
          eyebrow={`PHASE ${phase.id.slice(0, 1)} · ${phase.titleZhHant}`}
          text={phase.narrationZhHant}
          rows={conditionArmed && !committed
            ? [
              { label: 'Δ', value: `${deltaDb.toFixed(2)} dB` },
              { label: 'TTT', value: `${tttProgressSec.toFixed(0)} / ${tttTotalSec} s` },
            ]
            : [
              { label: servingName, value: `${servingElevationDeg.toFixed(1)}°` },
              { label: candidateName, value: `${candidateElevationDeg.toFixed(1)}°` },
            ]}
          tone={phase.autoPause ? 'source' : 'neutral'}
        />
      )}
    </div>
  );
}
