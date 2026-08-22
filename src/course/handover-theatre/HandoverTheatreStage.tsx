import type { ReactElement } from 'react';

import {
  SixActsOverlayCard,
  SixActsOverlayStage,
} from '../nav/SixActsAnnotation';
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

  // Cards are positioned in percent of the stage box so they track the same
  // satellites the SVG draws, which is what makes a screenshot self-explaining.
  const percent = (x: number, y: number) => ({ left: (x / width) * 100, top: (y / height) * 100 });
  const servingAt = percent(servingX, servingY);
  const candidateAt = percent(candidateX, candidateY);

  return (
    <SixActsOverlayStage>
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

      {/* The narration lives ON the thing it is about, so a recording carries
          its own subtitles and a slide screenshot arrives explained. */}
      {phase === null ? null : (
        <SixActsOverlayCard
          leftPercent={3}
          topPercent={97}
          anchor="bottom-left"
          content={{
            eyebrow: `PHASE ${phase.id.slice(0, 1)} · ${phase.titleZhHant}`,
            title: phase.narrationZhHant,
            badge: phase.autoPause ? '自動暫停' : undefined,
            tone: phase.autoPause ? 'source' : 'neutral',
          }}
        />
      )}

      <SixActsOverlayCard
        leftPercent={servingAt.left}
        topPercent={servingAt.top < 34 ? servingAt.top + 14 : servingAt.top - 26}
        content={{
          eyebrow: committed ? '前服務衛星' : '服務衛星',
          title: servingName,
          rows: [
            { label: '仰角', value: `${servingElevationDeg.toFixed(1)}°` },
            { label: '狀態', value: committed ? '已交出連線' : servingElevationDeg < 10 ? '低仰角，正在下沉' : '服務中' },
          ],
          tone: committed ? 'warn' : 'serving',
        }}
      />

      {!showCandidate ? null : (
        <SixActsOverlayCard
          leftPercent={candidateAt.left}
          // Above the satellite when there is room, below it when the pass is
          // near zenith — otherwise the card lands in the rule box.
          topPercent={candidateAt.top < 34 ? candidateAt.top + 14 : candidateAt.top - 26}
          anchor="top-right"
          content={{
            eyebrow: committed ? '新服務衛星' : '候選衛星',
            title: candidateName,
            rows: [
              { label: '仰角', value: `${candidateElevationDeg.toFixed(1)}°` },
              { label: 'ΔSINR', value: `+${deltaDb.toFixed(2)} dB` },
            ],
            tone: committed ? 'serving' : 'candidate',
          }}
        />
      )}

      {!conditionArmed || committed ? null : (
        <SixActsOverlayCard
          leftPercent={97}
          topPercent={97}
          anchor="bottom-right"
          content={{
            eyebrow: '換手條件',
            title: `持續 ${tttProgressSec.toFixed(0)} / ${tttTotalSec} 秒`,
            body: '兩個條件要同時成立：候選比服務好過門檻，而且這件事得撐滿整段 TTT。差一秒都不算。',
            tone: 'source',
          }}
        />
      )}
    </div>
    </SixActsOverlayStage>
  );
}
