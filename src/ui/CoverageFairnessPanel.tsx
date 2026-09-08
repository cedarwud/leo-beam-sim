import type { FrameCoverage, WindowServedFractionStats } from '../showcase/coverageFairness';
import type { ReplayArm } from './ReplayArmToggle';

// Coverage / Gini / Lorenz surfaces for a recorded replay-proof lane.
//
// DISPLAY-ONLY. Every number here is aggregated by the pure `coverageFairness.ts`
// from producer `served` / `starved` truth baked into the recorded window. These
// components compute no coverage and touch no truth — they render the producer
// coverage win-axis (served 0.26 → 0.997) so a layperson or a committee can read
// the toggle-slam. Two mounts: a live coverage% pill in the top bar and the Expert
// fairness panel (Lorenz + Gini + worst-off + live starved count).
//
// The field colours (green served / red starved) are echoed here on purpose so the
// panel and the 3D field read as one story.
const SERVED_GREEN = '#22c55e';
const STARVED_RED = '#ef4444';

// Producer per-frame Jain fairness index (mean over the window), from each arm's
// manifest.selfChecks.fairness_jain_mean (producer HEAD 33cc302). DIAGNOSTIC-ONLY:
// Jain rewards equal-misery collapse, so b1 scores HIGH (0.988) while starving 74
// UEs — which is exactly why coverage/served + EE, NOT Jain, is the win axis.
// TODO(P3 slice-3): source this live from the staged manifest once the provenance
// bridge (slice-2 D) is manifest-driven, instead of this producer-excerpt constant.
const PRODUCER_JAIN_DIAGNOSTIC: Readonly<Record<ReplayArm, number>> = { a2: 0.809, b1: 0.988 };

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

export interface CoverageTopbarProps {
  readonly coverage: FrameCoverage | null;
}

/** Live current-frame coverage pill for the top bar (served / total this frame). */
export function CoverageTopbar({ coverage }: CoverageTopbarProps) {
  const fill = coverage && coverage.total > 0 ? coverage.pct : 0;
  return (
    <div className="leo-coverage-topbar" data-testid="coverage-topbar" data-coverage-pct={fill.toFixed(1)}>
      <span className="leo-coverage-topbar__label" aria-hidden="true">覆蓋 Coverage</span>
      <span className="leo-coverage-topbar__bar" aria-hidden="true">
        <span className="leo-coverage-topbar__fill" style={{ width: `${fill}%` }} />
      </span>
      <span className="leo-coverage-topbar__value">
        {coverage ? `${fill.toFixed(0)}% · ${coverage.served}/${coverage.total} served` : '—'}
      </span>
    </div>
  );
}

// --- Expert fairness panel -------------------------------------------------

const SVG_W = 208;
const SVG_H = 188;
const PLOT_LEFT = 34;
const PLOT_TOP = 12;
const PLOT_W = 150;
const PLOT_H = 150;
const PLOT_BOTTOM = PLOT_TOP + PLOT_H;
const PLOT_RIGHT = PLOT_LEFT + PLOT_W;

function toSvg([x, y]: readonly [number, number]): string {
  return `${(PLOT_LEFT + x * PLOT_W).toFixed(1)},${(PLOT_BOTTOM - y * PLOT_H).toFixed(1)}`;
}

export interface CoverageFairnessPanelProps {
  readonly arm: ReplayArm;
  readonly stats: WindowServedFractionStats | null;
  readonly currentCoverage: FrameCoverage | null;
  /** Live starved count this frame (via replayFieldColor.countStarvedUes). */
  readonly currentStarved: number | null;
}

/** Expert coverage/fairness panel: mean + worst-off + live starved + Gini/Lorenz. */
export function CoverageFairnessPanel({
  arm,
  stats,
  currentCoverage,
  currentStarved,
}: CoverageFairnessPanelProps) {
  if (stats === null) {
    return (
      <section className="leo-coverage-panel" data-testid="coverage-fairness-panel" aria-label="Coverage and fairness">
        <header className="leo-coverage-panel__header">覆蓋 / 公平 · Coverage / Fairness</header>
        <p className="leo-coverage-panel__empty">Loading recorded window…</p>
      </section>
    );
  }

  const lorenzPolyline = stats.lorenzPoints.map(toSvg).join(' ');
  // The Gini area = the lens between the equality diagonal and the Lorenz curve.
  // The curve runs (0,0)→(1,1); closing the polygon back to the origin traces the
  // diagonal, so the filled polygon IS that area.
  const giniArea = stats.lorenzPoints.map(toSvg).join(' ');
  const jain = PRODUCER_JAIN_DIAGNOSTIC[arm];

  return (
    <section
      className="leo-coverage-panel"
      data-testid="coverage-fairness-panel"
      data-arm={arm}
      data-gini={stats.gini.toFixed(4)}
      aria-label="Coverage and fairness"
    >
      <header className="leo-coverage-panel__header">覆蓋 / 公平 · Coverage / Fairness</header>

      <div className="leo-coverage-panel__stats">
        <div className="leo-coverage-panel__stat">
          <span className="leo-coverage-panel__stat-value" style={{ color: SERVED_GREEN }}>
            {pct(stats.meanServedFraction)}
          </span>
          <span className="leo-coverage-panel__stat-label">平均覆蓋</span>
          <span className="leo-coverage-panel__stat-sub">mean served</span>
        </div>
        <div className="leo-coverage-panel__stat">
          <span
            className="leo-coverage-panel__stat-value"
            style={{ color: stats.minServedFraction === 0 ? STARVED_RED : undefined }}
          >
            {pct(stats.minServedFraction)}
          </span>
          <span className="leo-coverage-panel__stat-label">最弱 UE</span>
          <span className="leo-coverage-panel__stat-sub">worst-off</span>
        </div>
        <div className="leo-coverage-panel__stat">
          <span
            className="leo-coverage-panel__stat-value"
            style={{ color: (currentStarved ?? 0) > 0 ? STARVED_RED : SERVED_GREEN }}
            data-testid="coverage-current-starved"
          >
            {currentStarved ?? '—'}
          </span>
          <span className="leo-coverage-panel__stat-label">當前餓死</span>
          <span className="leo-coverage-panel__stat-sub">starved now</span>
        </div>
        <div className="leo-coverage-panel__stat">
          <span className="leo-coverage-panel__stat-value">{stats.gini.toFixed(3)}</span>
          <span className="leo-coverage-panel__stat-label">Gini</span>
          <span className="leo-coverage-panel__stat-sub">↓ = equal</span>
        </div>
      </div>

      <svg
        className="leo-coverage-panel__lorenz"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        role="img"
        aria-label={`Lorenz curve of per-UE coverage, Gini ${stats.gini.toFixed(3)}`}
      >
        <text className="leo-coverage-panel__lorenz-title" x="6" y="10">
          Lorenz · coverage share across UEs
        </text>
        {/* Gini-area lens between the equality diagonal and the Lorenz curve. */}
        <polygon className="leo-coverage-panel__lorenz-area" points={giniArea} />
        {/* equality diagonal (perfect fairness reference) */}
        <line
          className="leo-coverage-panel__lorenz-equality"
          x1={PLOT_LEFT}
          y1={PLOT_BOTTOM}
          x2={PLOT_RIGHT}
          y2={PLOT_TOP}
        />
        {/* the Lorenz curve itself */}
        <polyline className="leo-coverage-panel__lorenz-curve" points={lorenzPolyline} />
        {/* axes */}
        <line className="leo-coverage-panel__lorenz-axis" x1={PLOT_LEFT} y1={PLOT_TOP} x2={PLOT_LEFT} y2={PLOT_BOTTOM} />
        <line className="leo-coverage-panel__lorenz-axis" x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT} y2={PLOT_BOTTOM} />
        <text className="leo-coverage-panel__lorenz-axis-label" x={PLOT_LEFT} y={SVG_H - 4}>
          UEs poorest → richest
        </text>
      </svg>

      <p className="leo-coverage-panel__note leo-coverage-panel__note--jain" data-testid="coverage-jain-diagnostic">
        <strong>Jain {jain.toFixed(3)}</strong> (producer · <em>diagnostic-only</em>): Jain rewards
        equal-misery collapse — b1 Jain 0.988 yet 74 starved → <strong>NOT a win axis</strong>.
      </p>
      <p className="leo-coverage-panel__note leo-coverage-panel__note--win">
        Win axis = <strong>coverage / served</strong> (0.26 → 0.997) + EE. Worst-off UE and Gini
        read the same story the field paints.
      </p>
      {currentCoverage ? (
        <p className="leo-coverage-panel__frame-note">
          this frame: {currentCoverage.served}/{currentCoverage.total} served
        </p>
      ) : null}
    </section>
  );
}
