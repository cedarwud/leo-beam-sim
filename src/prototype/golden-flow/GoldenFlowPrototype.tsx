import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import { GOLDEN_FLOW_SATELLITE_STAGE_SCALE, GoldenFlowScene } from './GoldenFlowScene';
import {
  GOLDEN_FLOW_BEATS,
  GOLDEN_FLOW_ANGLE_LESSON_ELEVATION_DEG,
  GOLDEN_FLOW_ANGLE_LESSON_OFF_AXIS_DEG,
  GOLDEN_FLOW_DETERMINISTIC_TEACHING_OFFSET_DEG,
  GOLDEN_FLOW_UE_TRAVEL_RANGE_DEG,
  GOLDEN_FLOW_TEACHING_MIN_GESTURE_DEG,
  GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC,
  GOLDEN_FLOW_INTERACTION_END_COURSE_TIME_SEC,
  GOLDEN_FLOW_HANDOVER_START_COURSE_TIME_SEC,
  GOLDEN_FLOW_NOMINAL_DURATION_SEC,
  courseTimeToBeat,
  goldenFlowBeatIndex,
  goldenFlowBeatHasAuthoredMotionHold,
  goldenFlowControlsAvailable,
  goldenFlowInteractionStateForCourseTime,
  goldenFlowMotionState,
  goldenFlowReplayBeatIndex,
  goldenFlowReviewFrameCourseTime,
  goldenFlowSceneConstellationFromSearch,
  goldenFlowSegmentDurationSec,
  goldenFlowSegmentForAct,
  loadGoldenFlowTruth,
  type GoldenFlowBeat,
  type GoldenFlowControlId,
  type GoldenFlowSegment,
  type GoldenFlowTruth,
} from './goldenFlowDirector';
import {
  TeachingAnimationTransport,
  type PlaybackSpeed,
} from '../../course/transport';
import { SixActsNav } from '../../course/nav/SixActsNav';
import { isSixActsLightCaptureMode, sixActsHref } from '../../course/nav/lightCapture';
import { GOLDEN_FLOW_ACT3_HREF, GOLDEN_FLOW_ACT4_HREF } from './goldenFlowRoutes';
import {
  buildGoldenFlowAngleLessonMetrics,
  GOLDEN_FLOW_ANGLE_LESSON_FULL_HPBW_RAD,
  GOLDEN_FLOW_ANGLE_LESSON_HALF_POWER_RAD,
} from './goldenFlowAngleLesson';
import {
  buildGoldenFlowCandidateComparisonFrame,
  buildGoldenFlowHandoverDecisionFrame,
  type GoldenFlowHandoverDecisionFrame,
} from './goldenFlowHandoverLesson';
import './GoldenFlowPrototype.scss';

type RingStyle = CSSProperties & { readonly '--progress': string };

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function formatSigned(value: number, digits = 2) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function formatDb(value: number | null, digits = 2) {
  return value === null ? '未提供' : `${formatSigned(value, digits)} dB`;
}

function sourceTime(instantUtc: string, timeZone = 'Asia/Taipei') {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(instantUtc));
}

function GoldenFlowTrace({ truth }: { readonly truth: GoldenFlowTruth }) {
  if (truth.eventKind === 'forced-continuity') {
    return (
      <div
        className="golden-flow-trace golden-flow-trace--continuity"
        data-testid="golden-flow-delta-trace"
        data-anchor-count="0"
        data-trace-mode="forced-continuity-event"
      >
        <div className="golden-flow-trace__heading">
          <span>事件來源：forced-continuity</span>
          <strong>無 Offset+TTT 錨點</strong>
        </div>
        <div className="golden-flow-continuity-note">
          <b>服務衛星已低於可見範圍</b>
          <div className="golden-flow-continuity-pair">
            <span><strong>{truth.sourceSatelliteName}</strong><small>NORAD {truth.sourceSatelliteId}</small></span>
            <i aria-hidden="true">↓</i>
            <span><strong>{truth.targetSatelliteName}</strong><small>NORAD {truth.targetSatelliteId}</small></span>
          </div>
        </div>
        <small className="golden-flow-trace__note">此事件不代表 3 dB＋30 s qualification；僅保留來源事件的連續性證據。</small>
      </div>
    );
  }

  const samples = truth.qualification;
  const width = 270;
  const height = 110;
  const left = 28;
  const right = width - 16;
  const top = 18;
  const bottom = height - 24;
  const y = (value: number) => {
    const min = Math.min(2.8, truth.offsetDb - 0.2);
    const max = Math.max(3.6, ...samples.map(sample => sample.deltaDb + 0.1));
    return bottom - (value - min) / (max - min) * (bottom - top);
  };
  const thresholdY = y(truth.offsetDb);

  return (
    <div
      className="golden-flow-trace"
      data-testid="golden-flow-delta-trace"
      data-anchor-count={samples.length}
      data-trace-mode="two-discrete-source-anchors"
    >
      <div className="golden-flow-trace__heading">
        <span>ΔSINR：兩個來源錨點</span>
        <strong>門檻 {truth.offsetDb.toFixed(0)} dB</strong>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="只有兩個離散來源錨點；中間沒有連續量測"
      >
        <line x1={left} x2={right} y1={thresholdY} y2={thresholdY} className="golden-flow-trace__threshold" />
        <text x={right} y={thresholdY - 6} textAnchor="end" className="golden-flow-trace__threshold-text">門檻 {truth.offsetDb.toFixed(0)} dB</text>
        {samples.map((sample, index) => {
          const x = samples.length === 1 ? left : left + (right - left) * index / (samples.length - 1);
          return (
            <g key={sample.instantUtc} data-testid="golden-flow-trace-anchor">
              <line x1={x} x2={x} y1={bottom} y2={y(sample.deltaDb)} className="golden-flow-trace__stem" />
              <circle cx={x} cy={y(sample.deltaDb)} r="5" />
              <text x={x} y={bottom + 17} textAnchor="middle" className="golden-flow-trace__time-text">{sample.progressSec} 秒</text>
              <text x={x} y={y(sample.deltaDb) - 9} textAnchor="middle" className="golden-flow-trace__val-text">+{sample.deltaDb.toFixed(2)} dB</text>
            </g>
          );
        })}
      </svg>
      <small className="golden-flow-trace__note">離散錨點之間沒有連續量測；TTT {truth.tttSec} 秒為來源事件資料。</small>
    </div>
  );
}

function PrimaryCue({
  beat,
  progress,
  truth,
  beamOffsetDeg,
  interactionComplete,
  onReplay,
  segment,
  sceneConstellation,
  availableControls,
}: {
  readonly beat: GoldenFlowBeat;
  readonly progress: number;
  readonly truth: GoldenFlowTruth;
  readonly beamOffsetDeg: number;
  readonly interactionComplete: boolean;
  readonly onReplay: () => void;
  readonly segment: GoldenFlowSegment;
  readonly sceneConstellation: 'starlink' | 'oneweb';
  readonly availableControls: readonly GoldenFlowControlId[];
}) {
  const baseProps = {
    'data-primary-teaching': 'true',
    'data-beat': beat.id,
    'data-primary-cue': beat.primaryCue,
  } as const;
  const hasControl = (control: GoldenFlowControlId) => availableControls.includes(control);
  const isForcedContinuity = truth.eventKind === 'forced-continuity';
  const isAngleLesson = segment.id === 'act3' || (segment.id === 'full' && beat.order <= 5);
  const angleLessonElevationDeg = isAngleLesson
    ? GOLDEN_FLOW_ANGLE_LESSON_ELEVATION_DEG
    : truth.servingElevationDeg;
  const act3SceneLabel = sceneConstellation === 'starlink' ? 'STARLINK 教學模型' : truth.sourceSatelliteName;

  if (beat.id === 'interaction') {
    return (
      <section
        {...baseProps}
        className="golden-flow-primary-cue golden-flow-axis-guide"
        data-stage-occluder
        data-guided-prompt="UE 從波束中心移向邊緣時，離軸角如何改變？"
      >
        <div className="golden-flow-axis-guide__header">
          <span>固定衛星、波束中心與仰角 55°</span>
          <strong>{interactionComplete ? 'UE 已向右移動' : '向右拖曳地面 UE'}</strong>
        </div>
        <div className="golden-flow-axis-control__footer">
          <output>
            {interactionComplete
              ? '離軸角增加，理想補償功率需求與 EE 已依同一計算鏈更新。'
              : '向右拖動 UE，讓離軸角張開並觀察下方數值。'}
          </output>
        </div>
      </section>
    );
  }

  if (beat.id === 'candidate') {
    return (
      <section {...baseProps} className="golden-flow-primary-cue golden-flow-pair" data-stage-occluder data-testid="golden-flow-candidate">
        <div><i className="is-source" /><span>目前服務</span><strong>{truth.sourceSatelliteName}</strong></div>
        <div><i className="is-target" /><span>{isForcedContinuity ? '連續性接替目標' : '候選進場'}</span><strong>{truth.targetSatelliteName}</strong></div>
      </section>
    );
  }

  if (beat.id === 'qualification') {
    if (isForcedContinuity) {
      return (
        <section {...baseProps} className="golden-flow-primary-cue golden-flow-threshold golden-flow-continuity-card" data-stage-occluder data-testid="golden-flow-qualification">
          <span>事件判定</span>
          <strong>不進入 Offset+TTT qualification</strong>
          <i>服務可見性中斷；候選只作連續性接替</i>
        </section>
      );
    }
    return (
      <section {...baseProps} className="golden-flow-primary-cue golden-flow-threshold" data-stage-occluder data-testid="golden-flow-qualification">
        <span>候選 − 服務</span>
        <strong>{formatDb(truth.deltaSinrDb)}</strong>
        <i>≥ {truth.offsetDb.toFixed(0)} dB 門檻</i>
      </section>
    );
  }

  if (beat.id === 'ttt') {
    if (isForcedContinuity) {
      return (
        <section {...baseProps} className="golden-flow-primary-cue golden-flow-ttt golden-flow-continuity-card" data-stage-occluder data-testid="golden-flow-ttt">
          <div className="golden-flow-ttt__fallback">
            <span>TTT</span>
            <strong>不適用</strong>
            <small>本事件未通過 Offset+TTT qualification</small>
          </div>
          <p>動畫呈現的是可見性中斷後的連續性接替，不是 30 秒觸發倒數。</p>
        </section>
      );
    }
    const tttProgress = clamp01(progress);
    return (
      <section {...baseProps} className="golden-flow-primary-cue golden-flow-ttt" data-stage-occluder data-testid="golden-flow-ttt">
        <div className="golden-flow-ttt__ring" style={{ '--progress': `${tttProgress * 360}deg` } as RingStyle}>
          <span>TTT</span>
          <strong>{Math.round(tttProgress * truth.tttSec)}</strong>
          <small>/ {truth.tttSec} s</small>
        </div>
        <p>換手觸發時間（TTT）為 {truth.tttSec} 秒；動畫依教學時長壓縮。</p>
      </section>
    );
  }

  if (beat.id === 'trace') {
    return (
      <section {...baseProps} className="golden-flow-primary-cue golden-flow-trace-cue" data-stage-occluder>
        <GoldenFlowTrace truth={truth} />
      </section>
    );
  }

  if (beat.id === 'commit') {
    return (
      <section {...baseProps} className="golden-flow-primary-cue golden-flow-commit" data-testid="golden-flow-commit">
        <span>{isForcedContinuity ? '連續性接替事件' : '跨衛星換手提交'}</span>
        <strong>{truth.sourceSatelliteName} <i>→</i> {truth.targetSatelliteName}</strong>
      </section>
    );
  }

  if (beat.id === 'receipt') {
    return (
      <section {...baseProps} className="golden-flow-primary-cue golden-flow-receipt" data-stage-occluder data-testid="golden-flow-receipt">
        <header><span>{isForcedContinuity ? '來源事件' : '已提交事件'}</span><strong>{isForcedContinuity ? '連續性接替收據' : '換手收據'}</strong></header>
        <dl>
          <div><dt>來源</dt><dd>{truth.sourceSatelliteName}</dd></div>
          <div><dt>目標</dt><dd>{truth.targetSatelliteName}</dd></div>
          <div><dt>時間</dt><dd>UTC {sourceTime(truth.eventInstantUtc, 'UTC')}</dd></div>
          <div><dt>事件</dt><dd>{isForcedContinuity ? 'forced-continuity' : '跨衛星換手'}</dd></div>
        </dl>
      </section>
    );
  }

  if (beat.id === 'new-normal') {
    const showReplay = hasControl('replay');
    const showNext = hasControl('next') && segment.nextHref !== null;
    return (
      <section {...baseProps} className="golden-flow-primary-cue golden-flow-finale" data-stage-occluder>
        <div><span>{isForcedContinuity ? '接替後服務' : '目前服務'}</span><strong>{truth.targetSatelliteName}</strong></div>
        {(showReplay || showNext) && <>
          {showReplay ? (
          <button type="button" data-control-id="replay" onClick={onReplay}>重新播放</button>
          ) : null}
          {showNext ? (
            <a data-control-id="next" href={sixActsHref(segment.nextHref!)}>{segment.nextLabelZhHant ?? '下一個場景'}</a>
          ) : null}
        </>}
      </section>
    );
  }

  if (beat.id === 'consequence') {
    return (
      <section {...baseProps} className="golden-flow-primary-cue golden-flow-consequence" data-stage-occluder>
        <strong>θ 增加 → 增益下降 → 理想補償功率需求上升 → 相對 EE 下降</strong>
      </section>
    );
  }

  if (beat.id === 'restore') {
    return (
      <section {...baseProps} className="golden-flow-primary-cue golden-flow-restore-marker" data-stage-occluder>
        <span>教學用波束偏移已移除</span>
        <strong>來源畫面與事件狀態已恢復</strong>
        <i style={{ width: `${Math.round(progress * 100)}%` }} />
        {segment.id === 'act3' && hasControl('replay-act3') && hasControl('next-act4') && (
          <div className="golden-flow-segment-finale" data-course-segment-finale>
            <button type="button" data-control-id="replay-act3" onClick={onReplay}>重新播放第 3 幕</button>
            <a data-control-id="next-act4" href={sixActsHref(segment.nextHref ?? GOLDEN_FLOW_ACT4_HREF)}>{segment.nextLabelZhHant ?? '下一幕'}</a>
          </div>
        )}
      </section>
    );
  }

  if (beat.id === 'angles') {
    return (
      <section {...baseProps} className="golden-flow-primary-cue golden-flow-angle-key" data-stage-occluder>
        <div data-testid="golden-flow-angle-elevation">
          <i className="is-elevation" />
          <span>地面終端為頂點</span>
          <strong>幾何仰角 α</strong>
          <small>{angleLessonElevationDeg.toFixed(1)}°</small>
        </div>
        <small>本段只固定仰角；下一段拖曳 UE 時，再從衛星端放大離軸角 θ。</small>
      </section>
    );
  }

  return (
    <section {...baseProps} className="golden-flow-primary-cue golden-flow-scene-cue">
      <span>{beat.id === 'establish' ? '固定來源資料' : '新的服務鏈路'}</span>
      <strong>{beat.id === 'establish' ? act3SceneLabel : truth.targetSatelliteName}</strong>
    </section>
  );
}

function AnglePowerEeReadout({
  thetaDeg,
  showFormula,
  primaryBeat,
}: {
  readonly thetaDeg: number;
  readonly showFormula: boolean;
  readonly primaryBeat?: GoldenFlowBeat;
}) {
  const metrics = buildGoldenFlowAngleLessonMetrics(thetaDeg);
  return (
    <section
      className={`golden-flow-angle-power-ee${showFormula ? ' has-formula' : ''}`}
      data-testid="golden-flow-angle-power-ee"
      data-angle-calculation="approved-canonical-angle-aware"
      data-actual-theta-deg={metrics.thetaDeg.toFixed(4)}
      data-primary-teaching={primaryBeat ? 'true' : undefined}
      data-beat={primaryBeat?.id}
      data-primary-cue={primaryBeat?.primaryCue}
      aria-label="離軸角透過天線方向圖影響增益、理想補償功率需求與相對能效"
    >
      <div className="golden-flow-angle-power-ee__conditions" aria-label="受控條件">
        <span><b>觀察變因</b> 離軸角 θ</span>
        <span><b>固定條件</b> 仰角 α＝{GOLDEN_FLOW_ANGLE_LESSON_ELEVATION_DEG.toFixed(1)}°</span>
        <span><b>固定條件</b> 服務量 R</span>
      </div>
      <div className="golden-flow-angle-power-ee__values">
        <div><span>離軸角 θ</span><strong>{metrics.thetaDeg.toFixed(2)}°</strong></div>
        <i aria-hidden="true">→</i>
        <div><span>方向圖 F(θ)</span><strong>{metrics.relativeGainPercent.toFixed(1)}%</strong></div>
        <i aria-hidden="true">→</i>
        <div><span>增益變化 ΔGᵀ</span><strong>{metrics.gainDeltaDb.toFixed(1)} dB</strong></div>
        <i aria-hidden="true">→</i>
        <div>
          <span>理想補償功率需求 P′</span>
          <strong>{metrics.requiredPowerW.toFixed(2)} W</strong>
          <small>中心基準 P₀＝{metrics.baselinePowerW.toFixed(2)} W；P′/P₀＝{metrics.powerMultiplier.toFixed(2)}×</small>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>相對 EE</span>
          <strong>{metrics.relativeEePercent.toFixed(1)}%</strong>
          <small>理想補償後鏈路相對值：{metrics.compensatedLinkPercent.toFixed(0)}%</small>
        </div>
      </div>
      <p className="golden-flow-angle-power-ee__note">
        P′ 是固定服務量下抵銷增益損失的理想補償功率需求，屬於模型估算；不是衛星實際發射功率，且本區數值未套用功率上限。
      </p>
      {showFormula && (
        <div className="golden-flow-angle-power-ee__formula" data-testid="golden-flow-angle-formula">
          <span><b>μ</b> = 2.07123 sin θ / sin(θ<sub>3dB</sub>/2)</span>
          <span><b>F(θ)</b> = [J₁(μ)/(2μ) + 36J₃(μ)/μ³]²</span>
          <span><b>Gᵀ(θ)</b> = G₀F(θ)</span>
          <span><b>P′</b> = P · Gᵀ<sub>前</sub> / Gᵀ<sub>現</sub> <small>（理想補償功率需求；未套用功率上限）</small></span>
          <span><b>EE</b> = R / P′ <small>（R 固定；相對鏈路比較）</small></span>
        </div>
      )}
    </section>
  );
}

const OFF_AXIS_INSET_VISUAL_SCALE = 8;

/**
 * Primary screen-space angle carrier. Both definitions read left-to-right,
 * while the 3D scene behind it preserves the real satellite/ground geometry.
 * Only the tiny theta separation is visually enlarged; every displayed value
 * and downstream calculation continues to use the actual angle.
 */
function AngleTeachingRail({
  thetaDeg,
  activeMode,
}: {
  readonly thetaDeg: number;
  readonly activeMode: 'elevation' | 'off-axis';
}) {
  const safeThetaDeg = Number.isFinite(thetaDeg) ? Math.max(0, thetaDeg) : 0;
  const displayThetaDeg = Math.min(36, safeThetaDeg * OFF_AXIS_INSET_VISUAL_SCALE);
  const thetaOrigin = { x: 34, y: 40 };
  const thetaRayLength = 205;
  const thetaArcRadius = 46;
  const pointAt = (radius: number, angleDeg: number) => {
    const angleRad = angleDeg * Math.PI / 180;
    return {
      x: thetaOrigin.x + Math.cos(angleRad) * radius,
      y: thetaOrigin.y + Math.sin(angleRad) * radius,
    };
  };
  const axisEnd = pointAt(thetaRayLength, 0);
  const ueEnd = pointAt(thetaRayLength, displayThetaDeg);
  const arcStart = pointAt(thetaArcRadius, 0);
  const arcEnd = pointAt(thetaArcRadius, displayThetaDeg);
  const labelPoint = pointAt(thetaArcRadius + 17, displayThetaDeg / 2);
  const ueLabelY = displayThetaDeg < 8 ? ueEnd.y + 22 : ueEnd.y - 10;
  const elevationDeg = GOLDEN_FLOW_ANGLE_LESSON_ELEVATION_DEG;
  const fullHpbwDeg = GOLDEN_FLOW_ANGLE_LESSON_FULL_HPBW_RAD * 180 / Math.PI;
  const halfPowerDeg = GOLDEN_FLOW_ANGLE_LESSON_HALF_POWER_RAD * 180 / Math.PI;
  const elevationOrigin = { x: 34, y: 116 };
  const elevationRayLength = 105;
  const elevationRad = elevationDeg * Math.PI / 180;
  const elevationEnd = {
    x: elevationOrigin.x + Math.cos(elevationRad) * elevationRayLength,
    y: elevationOrigin.y - Math.sin(elevationRad) * elevationRayLength,
  };
  const elevationArcRadius = 40;
  const elevationArcEnd = {
    x: elevationOrigin.x + Math.cos(elevationRad) * elevationArcRadius,
    y: elevationOrigin.y - Math.sin(elevationRad) * elevationArcRadius,
  };

  // The elevation and off-axis figures used to stack in one right-anchored
  // rail, which doubled its height and could run into the top of the
  // current-event dock at beat 'interaction'/'consequence' (the dock grows
  // taller there to fit the angle/power/EE readout). Splitting them into two
  // independently-anchored panels — elevation top-left, off-axis top-right —
  // halves each panel's height, clearing the dock without touching the
  // dock's own sizing. The outer <aside> stays a single full-bleed, visually
  // invisible wrapper so it keeps carrying all the existing test hooks
  // (data-testid, data-active-angle, aria-label) as one element; only the
  // two inner panels are visually boxed and positioned.
  return (
    <aside
      className="golden-flow-angle-teaching-rail"
      data-testid="golden-flow-angle-teaching-rail"
      data-primary-angle-carrier="true"
      data-active-angle={activeMode}
      data-actual-theta-deg={safeThetaDeg.toFixed(4)}
      data-angle-visual-scale={OFF_AXIS_INSET_VISUAL_SCALE}
      aria-label={`角度定義。仰角 ${elevationDeg.toFixed(1)} 度，以地面 UE 為頂點；離軸角 ${safeThetaDeg.toFixed(2)} 度，以衛星為頂點。兩者均由左往右呈現。`}
    >
      <div className="golden-flow-angle-teaching-rail__panel golden-flow-angle-teaching-rail__panel--elevation">
        <header><span>角度定義</span><small>地面端頂點，左往右量測</small></header>
        <figure className={activeMode === 'elevation' ? 'is-active' : ''}>
          <figcaption><span>地面端頂點</span><strong>仰角 α = {elevationDeg.toFixed(1)}°</strong></figcaption>
          <svg viewBox="0 0 270 132" aria-hidden="true">
            <circle className="is-elevation-vertex" cx={elevationOrigin.x} cy={elevationOrigin.y} r="6" />
            <line className="is-horizontal-reference" x1={elevationOrigin.x} y1={elevationOrigin.y} x2="244" y2={elevationOrigin.y} />
            <line className="is-elevation-los" x1={elevationOrigin.x} y1={elevationOrigin.y} x2={elevationEnd.x} y2={elevationEnd.y} />
            <path className="is-elevation-arc" d={`M ${elevationOrigin.x + elevationArcRadius} ${elevationOrigin.y} A ${elevationArcRadius} ${elevationArcRadius} 0 0 0 ${elevationArcEnd.x} ${elevationArcEnd.y}`} />
            <text x="8" y="108">UE</text>
            <text x="174" y="108">水平基準</text>
            <text x={elevationEnd.x + 8} y={Math.max(18, elevationEnd.y)}>往衛星</text>
            <text className="is-angle-symbol" x="76" y="83">α</text>
          </svg>
        </figure>
      </div>
      <div className="golden-flow-angle-teaching-rail__panel golden-flow-angle-teaching-rail__panel--off-axis">
        <header><span>角度定義</span><small>衛星端頂點，左往右量測</small></header>
        <figure className={activeMode === 'off-axis' ? 'is-active' : ''}>
          <figcaption><span>衛星端頂點</span><strong>離軸角 θ = {safeThetaDeg.toFixed(2)}°</strong></figcaption>
          <svg viewBox="0 0 270 158" aria-hidden="true">
            <circle className="is-theta-vertex" cx={thetaOrigin.x} cy={thetaOrigin.y} r="6" />
            <line className="is-beam-axis" x1={thetaOrigin.x} y1={thetaOrigin.y} x2={axisEnd.x} y2={axisEnd.y} />
            <line className="is-ue-ray" x1={thetaOrigin.x} y1={thetaOrigin.y} x2={ueEnd.x} y2={ueEnd.y} />
            {displayThetaDeg >= 0.1 && <path className="is-theta-arc" d={`M ${arcStart.x} ${arcStart.y} A ${thetaArcRadius} ${thetaArcRadius} 0 0 1 ${arcEnd.x} ${arcEnd.y}`} />}
            <text x="5" y="33">衛星</text>
            <text x={axisEnd.x - 70} y={axisEnd.y - 9}>波束中軸</text>
            <text x={ueEnd.x - 42} y={ueLabelY}>往 UE</text>
            {displayThetaDeg >= 0.1 && <text className="is-angle-symbol" x={labelPoint.x} y={labelPoint.y}>θ</text>}
          </svg>
          <small>
            θ<sub>3dB</sub>＝{fullHpbwDeg.toFixed(2)}°（全寬），半功率邊界 ±{halfPowerDeg.toFixed(2)}°；
            圖形角距 ×{OFF_AXIS_INSET_VISUAL_SCALE}，計算仍用實際 θ。
          </small>
        </figure>
      </div>
    </aside>
  );
}

function HandoverDecisionReadout({
  beat,
  progress,
  truth,
}: {
  readonly beat: GoldenFlowBeat;
  readonly progress: number;
  readonly truth: GoldenFlowTruth;
}) {
  const frame = buildGoldenFlowHandoverDecisionFrame(beat.id, progress, truth);
  const candidateComparison = beat.id === 'candidate' && truth.eventKind === 'teaching-handover'
    ? buildGoldenFlowCandidateComparisonFrame(progress, truth)
    : null;
  const sourceIsActive = frame.activeService === 'source';
  const decisionLabel = beat.id === 'commit'
    ? frame.transferStage === 'release-source'
      ? '原服務鏈路退出中'
      : frame.transferStage === 'switch-owner'
        ? '服務身分已切換'
        : frame.transferStage === 'establish-target'
          ? '建立新服務鏈路'
          : frame.transferStage === 'stable-target'
            ? `${truth.targetSatelliteName} 已穩定接手`
            : 'TTT 已完成，準備切換'
    : frame.committed
    ? `${truth.targetSatelliteName} 已接手`
    : frame.tttComplete
      ? '條件完成，提交換手'
      : frame.thresholdMet
        ? truth.eventKind === 'teaching-handover'
          ? '門檻成立，持續計時'
          : '來源錨點達到門檻'
        : beat.id === 'candidate'
          ? '比較候選集合與服務 SINR'
          : '比較服務 SINR 與候選比較值';
  return (
    <div
      className="golden-flow-primary-cue golden-flow-handover-decision"
      data-primary-teaching="true"
      data-beat={beat.id}
      data-primary-cue={beat.primaryCue}
      data-testid="golden-flow-handover-decision"
      data-handover-phase={frame.phase}
      data-threshold-met={frame.thresholdMet ? 'true' : 'false'}
      data-ttt-complete={frame.tttComplete ? 'true' : 'false'}
      data-handover-committed={frame.committed ? 'true' : 'false'}
      data-active-service={frame.activeService}
      data-active-service-count="1"
      data-dual-connectivity="false"
      data-candidate-measurement-only={sourceIsActive ? 'true' : 'false'}
    >
      {candidateComparison ? (
        <div className="golden-flow-candidate-comparison" data-testid="golden-flow-candidate-comparison">
          <header>
            <strong>候選集合</strong>
            <span>目前服務 {truth.sourceSatelliteName}：{formatSigned(frame.servingSinrDb, 1)} dB</span>
            <small>受控教學比較值</small>
          </header>
          <div>
            {candidateComparison.entries.map(entry => (
              <article key={entry.marker} className={entry.selected ? 'is-selected' : ''} data-selected={entry.selected ? 'true' : 'false'}>
                <em>{entry.marker}</em>
                <span>{entry.satelliteName}</span>
                <strong>{formatSigned(entry.sinrDb, 1)} dB</strong>
                <small>差值 {formatSigned(entry.deltaDb, 1)} dB</small>
                <b>{entry.selected ? '目前最佳' : `排序 ${entry.rank}`}</b>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="golden-flow-handover-decision__links">
          <div className="is-source">
            <span>{sourceIsActive ? '唯一服務鏈路' : '舊鏈路・已退出'}</span>
            <strong>{truth.sourceSatelliteName}</strong>
            <b>{formatSigned(frame.servingSinrDb, 1)} dB</b>
          </div>
          <div className="is-candidate">
            <span>{sourceIsActive ? '候選比較值・未連線' : '唯一服務鏈路'}</span>
            <strong>{truth.targetSatelliteName}</strong>
            <b>{formatSigned(frame.candidateSinrDb, 1)} dB</b>
          </div>
        </div>
      )}
      {truth.eventKind !== 'teaching-handover' && (
        <small className="golden-flow-handover-decision__source-boundary">
          來源只提供離散事件錨點；段落動畫不代表逐秒 SINR 量測。
        </small>
      )}
      <div className="golden-flow-handover-decision__chain" aria-label="換手判定順序">
        <div className={frame.thresholdMet ? 'is-passed' : ''}>
          <span>候選 − 服務</span>
          <strong>{formatSigned(frame.deltaDb, 1)} dB</strong>
          <small>門檻 ≥ {frame.thresholdDb.toFixed(1)} dB</small>
        </div>
        <i aria-hidden="true">→</i>
        <div className={frame.tttComplete ? 'is-passed' : frame.thresholdMet ? 'is-running' : ''}>
          <span>持續時間 TTT</span>
          <strong>{Math.round(frame.tttElapsedSec)} / {frame.tttSec} s</strong>
          <small>{frame.thresholdMet
            ? truth.eventKind === 'teaching-handover' ? '條件持續成立' : '依來源政策進度顯示'
            : '尚未開始計時'}</small>
          <b style={{ width: `${frame.tttSec > 0 ? frame.tttElapsedSec / frame.tttSec * 100 : 0}%` }} />
        </div>
        <i aria-hidden="true">→</i>
        <div className={frame.committed ? 'is-passed' : frame.tttComplete ? 'is-running' : ''}>
          <span>服務關係</span>
          <strong>{decisionLabel}</strong>
          <small>{frame.committed ? '原鏈路已退出' : '維持單一服務鏈路'}</small>
        </div>
      </div>
    </div>
  );
}

function HandoverTransferBanner({
  frame,
  targetName,
}: {
  readonly frame: GoldenFlowHandoverDecisionFrame;
  readonly targetName: string;
}) {
  const activeStep = frame.transferStage === 'not-started' || frame.transferStage === 'release-source'
    ? 0
    : frame.transferStage === 'switch-owner'
      ? 1
      : 2;
  const title = frame.transferStage === 'not-started'
    ? 'TTT 已完成，準備執行換手'
    : frame.transferStage === 'release-source'
      ? '原服務鏈路退出'
      : frame.transferStage === 'switch-owner'
        ? '服務身分切換'
        : frame.transferStage === 'establish-target'
          ? `建立 ${targetName} 服務鏈路`
          : `${targetName} 已穩定接手`;
  return (
    <aside
      className="golden-flow-handover-transfer-banner"
      data-testid="golden-flow-handover-transfer-banner"
      data-transfer-stage={frame.transferStage}
      aria-label={`換手執行進度：${title}`}
    >
      <header><span>換手執行</span><strong>{title}</strong></header>
      <div>
        {['舊鏈路退出', '服務身分切換', '新鏈路建立'].map((label, index) => (
          <span key={label} className={index < activeStep ? 'is-complete' : index === activeStep ? 'is-active' : ''}>
            <i>{index + 1}</i>{label}
          </span>
        ))}
      </div>
    </aside>
  );
}

const LEGACY_CARRIER_NARRATIVE: Readonly<Record<GoldenFlowBeat['id'], {
  readonly question: string;
  readonly body: string;
}>> = Object.freeze({
  establish: Object.freeze({
    question: '目前由哪一顆衛星服務地面終端？',
    body: '同一畫面呈現服務衛星、地面終端、波束中軸與服務鏈路。',
  }),
  angles: Object.freeze({
    question: '仰角 α 是從哪裡量起？',
    body: '仰角以地面 UE 為頂點。本實驗先固定 α＝55°；下一段只觀察衛星端的離軸角 θ。',
  }),
  interaction: Object.freeze({
    question: '離軸角如何影響理想補償功率需求與相對 EE？',
    body: '將 UE 向右拖離波束中心。服務量固定時，增益下降會提高理想補償功率需求，並降低相對 EE；P′ 是理想估算，不是衛星實際發射功率。',
  }),
  consequence: Object.freeze({
    question: '為什麼離軸角增加會提高理想補償功率需求？',
    body: '仰角固定為 55°；只有離軸角改變。離軸增益下降，因此維持相同服務量的理想補償功率需求上升；本區數值未套用功率上限。',
  }),
  restore: Object.freeze({
    question: '移除教學偏移後，哪些狀態應恢復為原值？',
    body: '移除教學用偏移，恢復封存事件的原始幾何狀態。',
  }),
  candidate: Object.freeze({
    question: '系統如何從候選集合選出換手目標？',
    body: '黃色仍是唯一服務鏈路；三條青色虛線只代表候選比較值。系統先比較 SINR，選出目前最佳的 B1，再檢查換手門檻。',
  }),
  qualification: Object.freeze({
    question: '什麼時候開始累積 TTT？',
    body: '候選比較完成後，畫面只追蹤 B1。只有「B1 SINR − 服務 SINR」達到 3 dB 閾值，TTT 才開始累積。',
  }),
  ttt: Object.freeze({
    question: '通過門檻後，為什麼還不能立刻切換？',
    body: '偏移條件還必須持續滿足觸發時間（TTT），系統才進入提交階段。',
  }),
  trace: Object.freeze({
    question: 'TTT 期間，條件有沒有中斷？',
    body: '候選優勢持續高於門檻，TTT 累積到 30 秒；若中途跌破門檻，計時就必須重置。',
  }),
  commit: Object.freeze({
    question: '何時才算真正提交跨衛星換手？',
    body: '偏移條件與 TTT 均成立後，服務關係才轉移至目標衛星。',
  }),
  receipt: Object.freeze({
    question: '如何確認換手已完成？',
    body: '候選衛星成為新的服務衛星，舊服務鏈路退出；兩顆衛星仍依同一時間軸運行。',
  }),
  'new-normal': Object.freeze({
    question: '提交後，哪一顆衛星成為新的服務衛星？',
    body: '目標衛星接續服務；後續幾何仍依封存資料呈現。',
  }),
});

const FORCED_CONTINUITY_NARRATIVE: Readonly<Record<GoldenFlowBeat['id'], {
  readonly eyebrow: string;
  readonly question: string;
  readonly body: string;
  readonly caption: readonly string[];
}>> = Object.freeze({
  establish: Object.freeze({
    eyebrow: '01 · Starlink 服務鏈路基準',
    question: '目前由哪一顆衛星服務地面終端？',
    body: '同一畫面呈現 Starlink 教學模型、地面終端與服務鏈路。',
    caption: ['固定 Starlink 教學模型與地面終端。', '後續事件資料會明確標示其來源與事件類型。'],
  }),
  angles: Object.freeze({
    eyebrow: '02 · 先固定幾何仰角',
    question: '仰角 α 是從哪裡量起？',
    body: '仰角以地面 UE 為頂點。本實驗先固定 α＝55°；下一段只觀察衛星端的離軸角 θ。',
    caption: ['先固定地面端仰角 α＝55°。', '下一段拖曳 UE，從衛星端觀察 θ。'],
  }),
  interaction: Object.freeze({
    eyebrow: '03 · UE 在固定波束內移動',
    question: '離軸角如何影響理想補償功率需求與相對 EE？',
    body: '將 UE 向右拖離波束中心；下方數值使用核准的角度感知計算鏈即時更新，P′ 是理想估算，不是衛星實際發射功率。',
    caption: ['固定衛星、波束中心與仰角。', '拖曳 UE，觀察理想補償功率需求與相對 EE。'],
  }),
  consequence: Object.freeze({
    eyebrow: '04 · UE 位置與離軸結果',
    question: '離軸角增加後，為什麼理想補償功率需求上升而 EE 下降？',
    body: '增益下降使維持相同服務量的理想補償功率需求上升；P′ 不是衛星實際發射功率，且本區數值未套用功率上限。',
    caption: ['離軸角增加，增益下降。', '理想補償功率需求上升，相對 EE 下降。'],
  }),
  restore: Object.freeze({
    eyebrow: '05 · 恢復來源資料狀態',
    question: '移除教學偏移後，哪些狀態應恢復為原值？',
    body: '移除教學用偏移，恢復封存事件的原始幾何狀態。',
    caption: ['移除教學偏移。', '確認來源狀態後繼續。'],
  }),
  candidate: Object.freeze({
    eyebrow: '06 · 目前服務與接替目標',
    question: '哪一顆衛星正在服務，哪一顆僅提供比較值？',
    body: '黃色是唯一服務鏈路；候選衛星只顯示比較狀態，尚未建立第二條服務鏈路。',
    caption: ['服務鏈路失去可見性，接替目標進入場景。', '這是 forced-continuity，不是 Offset+TTT。'],
  }),
  qualification: Object.freeze({
    eyebrow: '07 · 不建立 Offset+TTT qualification',
    question: '這個事件是否具備 3 dB＋30 s qualification？',
    body: '服務衛星失去可見性後，系統啟動連續性接替；這筆事件沒有 SINR 差值與 qualification 錨點。',
    caption: ['此事件不具備有效 Offset+TTT qualification。', '來源衛星不可見，候選只作連續性接替。'],
  }),
  ttt: Object.freeze({
    eyebrow: '08 · TTT 不適用於本事件',
    question: '為什麼這裡不顯示 TTT 倒數？',
    body: '畫面不顯示倒數，因為這筆事件由可見性中斷觸發，不是候選優勢持續 30 秒。',
    caption: ['TTT 不適用於這個事件。', '畫面呈現可見性接替，不是 30 秒觸發。'],
  }),
  trace: Object.freeze({
    eyebrow: '09 · 連續性事件證據',
    question: '來源事件留下哪些可驗證證據？',
    body: '目前只核對黃色鏈路失去可見性，以及青色接替目標的衛星身分。',
    caption: ['來源證據是可見性中斷與接替身份。', '沒有 qualification 錨點可供繪製。'],
  }),
  commit: Object.freeze({
    eyebrow: '10 · 連續性接替事件',
    question: '何時完成連續性接替？',
    body: '青色鏈路接手服務，黃色鏈路退出；這次轉移不宣稱通過偏移與 TTT。',
    caption: ['連續性接替事件轉移服務身份。', '它不是有效的 3 dB＋30 s 換手。'],
  }),
  receipt: Object.freeze({
    eyebrow: '11 · 連續性事件追溯紀錄',
    question: '這筆 continuity 事件可以追溯到什麼？',
    body: '畫面停在事件收據，核對來源、目標、時間與事件類型；未提供的 SINR／TTT 不作推定。',
    caption: ['收據列出來源、目標、時間與 forced-continuity。', '未提供的 SINR／TTT 欄位不作推定。'],
  }),
  'new-normal': Object.freeze({
    eyebrow: '12 · 接替後服務狀態',
    question: '接替後場景如何回到可觀察狀態？',
    body: '青色目標現在承接服務；畫面保留新服務鏈路，讓使用者確認換手後狀態。',
    caption: ['目標衛星接續服務。', '事件類型仍是 forced-continuity。'],
  }),
});

export function GoldenFlowPrototype() {
  const lightCapture = isSixActsLightCaptureMode();
  const sceneConstellation = useMemo(() => (
    typeof window === 'undefined'
      ? 'starlink' as const
      : goldenFlowSceneConstellationFromSearch(window.location.search)
  ), []);
  const truth = useMemo(() => loadGoldenFlowTruth(sceneConstellation), [sceneConstellation]);
  const segment = useMemo(() => {
    if (typeof window === 'undefined') return goldenFlowSegmentForAct(null);
    if (window.location.pathname === GOLDEN_FLOW_ACT3_HREF) return goldenFlowSegmentForAct('3');
    if (window.location.pathname === GOLDEN_FLOW_ACT4_HREF) return goldenFlowSegmentForAct('4');
    return goldenFlowSegmentForAct(new URLSearchParams(window.location.search).get('act'));
  }, []);
  const requestedBeat = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return goldenFlowBeatIndex(new URLSearchParams(window.location.search).get('beat'));
  }, []);
  const reviewMode = requestedBeat !== null;
  const segmentDurationSec = goldenFlowSegmentDurationSec(segment);
  const initialBeatIndex = requestedBeat ?? goldenFlowReplayBeatIndex(segment);
  const initialCourseTimeSec = reviewMode
    ? goldenFlowReviewFrameCourseTime(initialBeatIndex, segment)
    : 0;
  const angleLessonOffAxisDeg = segment.id === 'act4'
    ? truth.servingOffAxisDeg
    : GOLDEN_FLOW_ANGLE_LESSON_OFF_AXIS_DEG;

  const [courseTimeSec, setCourseTimeSec] = useState(() => initialCourseTimeSec);
  const [isPlaying, setIsPlaying] = useState(!reviewMode);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);

  const initialInteractionCompleted = segment.id !== 'act4' && (
    goldenFlowInteractionStateForCourseTime(initialCourseTimeSec, segment) === 'completed'
    || (requestedBeat !== null && requestedBeat >= 3)
  );

  const [beamOffsetDeg, setBeamOffsetDeg] = useState(() => (
    initialInteractionCompleted
      ? angleLessonOffAxisDeg + GOLDEN_FLOW_DETERMINISTIC_TEACHING_OFFSET_DEG
      : angleLessonOffAxisDeg
  ));
  const [interactionComplete, setInteractionComplete] = useState(initialInteractionCompleted);
  const [interactionSubmittedAt, setInteractionSubmittedAt] = useState<number | null>(
    initialInteractionCompleted ? 0 : null,
  );
  const [predictionRecorded, setPredictionRecorded] = useState(initialInteractionCompleted);
  const [guidedResponse, setGuidedResponse] = useState<'gesture' | null>(
    initialInteractionCompleted ? 'gesture' : null,
  );
  const [gestureCount, setGestureCount] = useState(initialInteractionCompleted ? 1 : 0);
  const [segmentEnded, setSegmentEnded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 760px)').matches;
  });
  const [mobileTransportRevealed, setMobileTransportRevealed] = useState(false);

  const lastNowRef = useRef<number | null>(null);

  const { beatIndex, beat, elapsedSec, beatProgress } = useMemo(() => {
    const res = courseTimeToBeat(courseTimeSec, segment);
    return {
      beatIndex: res.beatIndex,
      beat: res.beat,
      elapsedSec: res.beatElapsedSec,
      beatProgress: res.beatProgress,
    };
  }, [courseTimeSec, segment]);

  const angleLessonElevationDeg = segment.id === 'act3'
    || (segment.id === 'full' && beatIndex < 5)
    ? GOLDEN_FLOW_ANGLE_LESSON_ELEVATION_DEG
    : truth.servingElevationDeg;
  useEffect(() => {
    setMobileTransportRevealed(false);
  }, [beat.id]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const handleSeek = useCallback((timeSec: number) => {
    const target = Math.max(0, Math.min(segmentDurationSec, timeSec));
    setCourseTimeSec(target);
    setSegmentEnded(target >= segmentDurationSec);
    setIsPlaying(false);

    if (segment.id !== 'act4') {
      const isPastInteraction = target >= GOLDEN_FLOW_INTERACTION_END_COURSE_TIME_SEC;
      setInteractionComplete(isPastInteraction);
      setInteractionSubmittedAt(isPastInteraction ? performance.now() : null);
      setBeamOffsetDeg(
        isPastInteraction
          ? angleLessonOffAxisDeg + GOLDEN_FLOW_DETERMINISTIC_TEACHING_OFFSET_DEG
          : angleLessonOffAxisDeg,
      );
      setPredictionRecorded(isPastInteraction);
      setGuidedResponse(isPastInteraction ? 'gesture' : null);
      setGestureCount(isPastInteraction ? 1 : 0);
    }
  }, [angleLessonOffAxisDeg, segment.id, segmentDurationSec]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => {
      if (prev) return false;
      if (segment.id !== 'act4' && !interactionComplete && courseTimeSec >= GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC) {
        return false;
      }
      if (courseTimeSec >= segmentDurationSec) {
        handleSeek(0);
        return true;
      }
      return true;
    });
  }, [courseTimeSec, handleSeek, interactionComplete, segment.id, segmentDurationSec]);

  const handleStepBackward = useCallback((stepSec = 5) => {
    handleSeek(Math.max(0, courseTimeSec - stepSec));
  }, [courseTimeSec, handleSeek]);

  const handleStepForward = useCallback((stepSec = 5) => {
    handleSeek(Math.min(segmentDurationSec, courseTimeSec + stepSec));
  }, [courseTimeSec, handleSeek, segmentDurationSec]);

  const handleSpeedChange = useCallback((speed: PlaybackSpeed) => {
    setPlaybackSpeed(speed);
  }, []);

  const replay = useCallback(() => {
    handleSeek(0);
    setIsPlaying(true);
  }, [handleSeek]);

  const submitTeachingOffset = useCallback((next: number) => {
    const bounded = Math.max(angleLessonOffAxisDeg, Math.min(angleLessonOffAxisDeg + GOLDEN_FLOW_UE_TRAVEL_RANGE_DEG, next));
    setBeamOffsetDeg(bounded);
    const qualifies = bounded - angleLessonOffAxisDeg >= GOLDEN_FLOW_TEACHING_MIN_GESTURE_DEG;
    setInteractionComplete(qualifies);
    if (qualifies) {
      setInteractionSubmittedAt(performance.now());
      setPredictionRecorded(true);
      setGuidedResponse('gesture');
      setGestureCount(1);
      setIsPlaying(true);
    } else {
      setInteractionSubmittedAt(null);
    }
  }, [angleLessonOffAxisDeg]);

  const handleSceneAxisPointerDown = useCallback(() => {
    setDragging(true);
    setPredictionRecorded(true);
    setGuidedResponse('gesture');
    setGestureCount(1);
  }, []);

  const handleSceneAxisPointerMove = useCallback((next: number) => {
    const bounded = Math.max(angleLessonOffAxisDeg, Math.min(angleLessonOffAxisDeg + GOLDEN_FLOW_UE_TRAVEL_RANGE_DEG, next));
    setBeamOffsetDeg(bounded);
  }, [angleLessonOffAxisDeg]);

  const handleSceneAxisPointerUp = useCallback((next: number) => {
    setDragging(false);
    submitTeachingOffset(next);
  }, [submitTeachingOffset]);

  const handleSceneAxisKeyboardCommit = useCallback((next: number) => {
    setPredictionRecorded(true);
    setGuidedResponse('gesture');
    setGestureCount(1);
    submitTeachingOffset(next);
  }, [submitTeachingOffset]);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (lastNowRef.current === null) {
        lastNowRef.current = now;
      }
      const rawDt = Math.max(0, (now - lastNowRef.current) / 1000);
      const dt = document.visibilityState === 'hidden' ? Math.min(0.1, rawDt) : rawDt;
      lastNowRef.current = now;

      if (isPlaying) {
        setCourseTimeSec(prev => {
          const isAct3OrFull = segment.id !== 'act4';
          if (isAct3OrFull && !interactionComplete && prev >= GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC) {
            setIsPlaying(false);
            return GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC;
          }
          if (isAct3OrFull && interactionComplete && prev >= GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC) {
            if (dragging || (interactionSubmittedAt !== null && now - interactionSubmittedAt < 1100)) {
              return GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC;
            }
          }
          if (prev >= segmentDurationSec) {
            setIsPlaying(false);
            setSegmentEnded(true);
            return segmentDurationSec;
          }
          const next = Math.min(segmentDurationSec, prev + dt * playbackSpeed);
          if (isAct3OrFull && !interactionComplete && next >= GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC) {
            setIsPlaying(false);
            return GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC;
          }
          if (isAct3OrFull && interactionComplete && prev < GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC && next >= GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC) {
            if (dragging || (interactionSubmittedAt !== null && now - interactionSubmittedAt < 1100)) {
              return GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC;
            }
          }
          if (next >= segmentDurationSec) {
            setIsPlaying(false);
            setSegmentEnded(true);
            return segmentDurationSec;
          }
          return next;
        });
      }

      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      lastNowRef.current = null;
    };
  }, [dragging, interactionComplete, interactionSubmittedAt, isPlaying, playbackSpeed, segment.id, segmentDurationSec]);

  const [reviewMountTime] = useState(() => performance.now());
  const [reviewWallElapsedSec, setReviewWallElapsedSec] = useState(0);

  useEffect(() => {
    if (!reviewMode) return;
    let raf = 0;
    const tick = () => {
      setReviewWallElapsedSec((performance.now() - reviewMountTime) / 1000);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [reviewMode, reviewMountTime]);

  const isSegmentEnded = segmentEnded || courseTimeSec >= segmentDurationSec;
  // Static review frames use a readable mid-beat cue, except commit: pausing
  // must preserve the actual side of the single-owner cutover instead of
  // jumping the service relation forward.
  const progress = (reviewMode && !isPlaying && beat.id !== 'commit') ? 0.62 : beatProgress;
  const segmentBeatCount = segment.endBeatIndex - segment.startBeatIndex + 1;
  const segmentBeatIndex = beatIndex - segment.startBeatIndex;
  const replayOffAxisDeg = segment.id === 'act4'
    || (segment.id === 'full' && beatIndex >= 5)
    ? truth.servingOffAxisDeg
    : angleLessonOffAxisDeg;
  const effectiveBeamOffset = beat.id === 'interaction' || beat.id === 'consequence'
    ? beamOffsetDeg
    : beat.id === 'restore'
      ? beamOffsetDeg + (angleLessonOffAxisDeg - beamOffsetDeg) * progress
      : replayOffAxisDeg;
  const effectiveElapsedSec = reviewMode ? Math.max(elapsedSec, reviewWallElapsedSec) : elapsedSec;
  const directorControls = goldenFlowControlsAvailable(beat, effectiveElapsedSec);
  // Keep both handoff actions visible for the complete finale beat.  The
  // director still owns the exact beat timing; this surface must not require
  // a user to land on the final animation frame before the route handoff is
  // usable.
  const segmentControls = segment.id === 'act3' && beat.id === 'restore'
    ? ['replay-act3', 'next-act4'] as const
    : segment.id === 'act4' && beat.id === 'new-normal'
      ? ['replay'] as const
      : [] as const;
  const controlsForSegment = segment.id === 'act4'
    ? directorControls.filter(control => control !== 'next')
    : directorControls;
  const visibleControlIds = [...new Set<GoldenFlowControlId>([...controlsForSegment, ...segmentControls])];
  const visibleControls = visibleControlIds.join(',');
  const counterfactualState = beat.id === 'interaction' || beat.id === 'consequence'
    ? 'active-canonical-angle-aware'
    : beat.id === 'restore' ? 'discarding' : 'source-anchor';
  const authoredMotionHold = goldenFlowBeatHasAuthoredMotionHold(beat);
  const satelliteMotionState = goldenFlowMotionState(isPlaying, authoredMotionHold);
  // Preserve the existing public teaching-state names while exposing the
  // transport pause reason and the per-satellite contract separately.
  const motionState = authoredMotionHold
    ? 'frozen-teaching-comparison'
    : isPlaying
      ? 'directed-playback'
      : 'frozen-transport-pause';
  const motionComponents = satelliteMotionState === 'frozen'
    ? 'satellite-track:paused,particles:paused,stars:paused,camera-animation:paused'
    : 'satellite-track:running,particles:running,stars:running,camera-animation:running';
  const motionFreezeReason = !isPlaying
    ? 'transport-paused'
    : authoredMotionHold
      ? 'authored-explanation-hold'
      : 'none';
  const angleBeat = beat.id === 'angles' || beat.id === 'interaction'
    || beat.id === 'consequence' || beat.id === 'restore';
  const showAnglePowerEe = beat.id === 'interaction' || beat.id === 'consequence';
  // 'interaction' is the only beat where the drag-instruction primary cue and
  // the angle/power/EE readout must render side by side. Moving the primary
  // cue into the copy column (which has vertical slack under the question
  // text) gives the angle/power/EE readout the dock's full width instead of
  // splitting it, so the metric cards and disclaimer stop clipping against
  // the dock's right edge at common desktop widths.
  const primaryCueInCopyColumn = beat.id === 'interaction';
  const isHandoverPresentation = segment.id === 'act4' || (segment.id === 'full' && beatIndex >= 5);
  const handoverFrame = buildGoldenFlowHandoverDecisionFrame(beat.id, progress, truth);
  const linkVisualState = !isHandoverPresentation
    ? 'source-only'
    : beat.id === 'commit'
      ? 'single-owner-cutover'
      : handoverFrame.activeService === 'target'
        ? 'target-only'
        : 'source-only,candidate-measurement';

  const isMobileTransportManaged = isMobile;
  const isMobileTransportHidden = isMobileTransportManaged && !mobileTransportRevealed;
  const isForcedContinuity = truth.eventKind === 'forced-continuity';
  const isTeachingHandover = truth.eventKind === 'teaching-handover';
  const pageTitle = isHandoverPresentation
    ? (isForcedContinuity
      ? 'Starlink 連續性接替與候選評估'
      : '跨衛星換手：閾值、TTT 與提交')
    : '離軸角對理想補償功率需求與相對 EE 的影響';
  // The Starlink forced-continuity record belongs to Act 4 only.  Act 3 uses
  // the Starlink GLB as a geometry teaching scene and must not inherit event
  // copy or event provenance merely because the same default fixture powers
  // the later handover segment.
  const forcedNarrative = isHandoverPresentation && isForcedContinuity
    ? FORCED_CONTINUITY_NARRATIVE[beat.id]
    : undefined;
  const sourceBackedCandidateNarrative = isHandoverPresentation
    && beat.id === 'candidate'
    && truth.eventKind === 'inter-handover'
    ? Object.freeze({
      eyebrow: '06 · 來源事件中的候選比較值',
      question: '來源事件記錄了哪一個換手候選？',
      body: '黃色仍是唯一服務鏈路；青色虛線只標示來源事件中已選定的候選。來源資料未提供完整候選排序。',
    })
    : undefined;
  const narrative = forcedNarrative ?? sourceBackedCandidateNarrative ?? LEGACY_CARRIER_NARRATIVE[beat.id];
  const activeEyebrow = forcedNarrative?.eyebrow ?? sourceBackedCandidateNarrative?.eyebrow ?? beat.eyebrow;
  const sceneMotionTimeSec = segment.id === 'full' && isHandoverPresentation
    ? Math.max(0, courseTimeSec - GOLDEN_FLOW_HANDOVER_START_COURSE_TIME_SEC)
    : courseTimeSec;

  return (
    <main
      className="golden-flow"
      data-theme={lightCapture ? 'light-capture' : undefined}
      data-testid="visual-first-golden-flow"
      data-beat={beat.id}
      data-beat-index={beatIndex + 1}
      data-course-segment={segment.id}
      data-course-segment-start={segment.startBeatId}
      data-course-segment-end={segment.endBeatId}
      data-course-segment-start-index={segment.startBeatIndex + 1}
      data-course-segment-end-index={segment.endBeatIndex + 1}
      data-course-segment-ended={isSegmentEnded ? 'true' : 'false'}
      data-course-beat-index={segmentBeatIndex + 1}
      data-course-beat-count={segmentBeatCount}
      data-camera-pose={beat.camera}
      data-camera-distance-profile="wide-classroom"
      data-satellite-stage-scale={GOLDEN_FLOW_SATELLITE_STAGE_SCALE}
      data-layout-carrier="legacy-3d-event-dock"
      data-ground-carrier="legacy-ground-grid-no-hex"
      data-spacecraft-carrier="constellation-glb-opaque"
      data-playback-speed={beat.speed}
      data-transport-playing={isPlaying ? 'true' : 'false'}
      data-transport-speed={String(playbackSpeed)}
      data-transport-time={courseTimeSec.toFixed(1)}
      data-transport-duration={segmentDurationSec.toFixed(1)}
      data-visible-controls={visibleControls}
      data-course-visible-controls={visibleControls}
      data-subject-overlap-policy="max-5-percent"
      data-control-availability={beat.controlAvailability.mode}
      data-control-available-after-sec={beat.controlAvailability.availableAfterSec}
      data-control-evaluation-elapsed-sec={effectiveElapsedSec.toFixed(3)}
      data-stable-hold-sec={beat.playback.stableHoldSec}
      data-review-mode={reviewMode ? 'true' : 'false'}
      data-source-variant={truth.variantId}
      data-scene-constellation={sceneConstellation}
      data-event-constellation={isHandoverPresentation ? truth.constellation : 'teaching-geometry'}
      data-event-kind={isHandoverPresentation ? truth.eventKind : 'geometry-teaching'}
      data-truth-mode={isHandoverPresentation
        ? isTeachingHandover ? 'controlled-teaching-scenario' : 'source-backed-event'
        : 'pinned-event-atlas'}
      data-geometry-mode="schematic-not-to-scale"
      data-runtime-mode="directed-visualization-not-live-replay"
      data-link-cue-mode={isHandoverPresentation ? 'handover-decision' : 'approved-canonical-angle-aware'}
      data-counterfactual-state={counterfactualState}
      data-effective-beam-offset-deg={effectiveBeamOffset.toFixed(4)}
      data-interaction-complete={interactionComplete ? 'true' : 'false'}
      data-prediction-shown={beat.id === 'interaction' ? 'true' : 'false'}
      data-prediction-recorded={predictionRecorded ? 'true' : 'false'}
      data-guided-response={guidedResponse ?? ''}
      data-gesture-count={gestureCount}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      data-motion-state={motionState}
      data-motion-components={motionComponents}
      data-motion-contract="single-clock-all-visible-satellites"
      data-motion-clock="segment-local-transport-time-sec"
      data-motion-time={sceneMotionTimeSec.toFixed(1)}
      data-satellite-trajectory="single-direction-local-flyby-schematic"
      data-motion-freeze-reason={motionFreezeReason}
      data-satellite-motion={satelliteMotionState}
      data-serving-satellite-motion={satelliteMotionState}
      data-candidate-satellite-motion={beatIndex >= 5 ? satelliteMotionState : 'not-present'}
      data-angle-vertices={beat.id === 'angles' ? 'ue' : angleBeat ? 'satellite' : 'hidden'}
      data-angle-elevation-deg={angleLessonElevationDeg.toFixed(3)}
      data-angle-off-axis-deg={angleLessonOffAxisDeg.toFixed(3)}
      data-link-visual-state={linkVisualState}
      data-link-visual-source="中央場景單一服務鏈路與候選比較值"
      data-active-service={isHandoverPresentation ? handoverFrame.activeService : 'source'}
      data-active-service-count="1"
      data-dual-connectivity="false"
      data-truth-boundary={isHandoverPresentation
        ? isTeachingHandover
          ? 'Starlink 受控教學情境；3 dB 閾值；30 秒 TTT；示意幾何；非 TLE 事件；非即時資料'
          : isForcedContinuity
            ? 'Starlink 來源 TLE/SGP4；forced-continuity；非 Offset+TTT；示意幾何；非即時資料；未提供 SINR'
            : '來源事件錨點；示意幾何；非即時資料'
        : '固定幾何教學條件；角度感知計算；非即時資料'}
      data-mobile-transport-revealed={mobileTransportRevealed ? 'true' : 'false'}
      data-mobile-transport-hidden={isMobileTransportHidden ? 'true' : 'false'}
    >
      <SixActsNav
        currentHref={segment.id === 'act3'
          ? GOLDEN_FLOW_ACT3_HREF
          : segment.id === 'act4'
            ? GOLDEN_FLOW_ACT4_HREF
            : ''}
        variant="stage"
      />

      <div className="golden-flow-legacy-shell">
        <section className="golden-flow-legacy-workspace">
          <section className="golden-flow-stage" data-testid="golden-flow-stage">
            <div
              className="golden-flow-subject-safe"
              data-testid="golden-flow-subject-safe"
              data-subject-role="scene-core"
              data-subject-overlap-policy="max-5-percent"
              aria-hidden="true"
            />
            <div className="golden-flow-canvas">
              <GoldenFlowScene
                beat={beat.id}
                beatIndex={beatIndex}
                progress={progress}
                cameraPose={beat.camera}
                sceneConstellation={sceneConstellation}
                beamOffsetDeg={effectiveBeamOffset}
                truth={truth}
                reducedMotion={reducedMotion}
                isPlaying={isPlaying}
                motionTimeSec={sceneMotionTimeSec}
                beamAxisDragging={dragging}
                onBeamAxisPointerDown={handleSceneAxisPointerDown}
                onBeamAxisPointerMove={handleSceneAxisPointerMove}
                onBeamAxisPointerUp={handleSceneAxisPointerUp}
                onBeamAxisKeyboardCommit={handleSceneAxisKeyboardCommit}
                lightCapture={lightCapture}
              />
            </div>

            {angleBeat && beat.id !== 'restore' && (
              <AngleTeachingRail
                thetaDeg={effectiveBeamOffset}
                activeMode={beat.id === 'angles' ? 'elevation' : 'off-axis'}
              />
            )}

            {isHandoverPresentation && beat.id === 'commit' && (
              <HandoverTransferBanner frame={handoverFrame} targetName={truth.targetSatelliteName} />
            )}

            {beat.id === 'candidate' && <div className="golden-flow-legacy-scene-key" aria-label="場景圖例">
              {isHandoverPresentation ? (
                <>
                  <span><i className="is-source" />目前服務</span>
                  <span><i className="is-target" />候選比較值・未連線</span>
                </>
              ) : (
                <span><i className="is-elevation" />本段：地面端仰角 α</span>
              )}
            </div>}

            {segment.id === 'act4' && (
              <aside className="golden-flow-mobile-identities" data-testid="golden-flow-mobile-identities" aria-label="換手衛星身分">
                <span className="is-source">
                  <small>前服務</small>
                  <strong>{truth.sourceSatelliteName}</strong>
                </span>
                <span className="is-target">
                  <small>{isForcedContinuity ? '接替目標' : '服務'}</small>
                  <strong>{truth.targetSatelliteName}</strong>
                </span>
              </aside>
            )}

          </section>

          <aside
            className="golden-flow-event-dock"
            aria-label={`${pageTitle}：${narrative.question}`}
            data-event-beat={beat.id}
            data-event-reveal="current-only"
          >
            <div className="golden-flow-event-dock__copy">
              <span>{activeEyebrow}</span>
              <h2>{narrative.question}</h2>
              <p>{narrative.body}</p>
              {primaryCueInCopyColumn && (
                <PrimaryCue
                  beat={beat}
                  progress={progress}
                  truth={truth}
                  sceneConstellation={sceneConstellation}
                  beamOffsetDeg={effectiveBeamOffset}
                  interactionComplete={interactionComplete}
                  onReplay={replay}
                  segment={segment}
                  availableControls={visibleControlIds}
                />
              )}
            </div>
            <div className={`golden-flow-event-dock__readout${showAnglePowerEe ? ' has-angle-power-ee' : ''}`}>
              {isHandoverPresentation && ['candidate', 'qualification', 'ttt', 'trace', 'commit', 'receipt'].includes(beat.id) ? (
                <HandoverDecisionReadout beat={beat} progress={progress} truth={truth} />
              ) : beat.id !== 'consequence' && !primaryCueInCopyColumn ? (
                <PrimaryCue
                  beat={beat}
                  progress={progress}
                  truth={truth}
                  sceneConstellation={sceneConstellation}
                  beamOffsetDeg={effectiveBeamOffset}
                  interactionComplete={interactionComplete}
                  onReplay={replay}
                  segment={segment}
                  availableControls={visibleControlIds}
                />
              ) : null}
              {showAnglePowerEe && (
                <AnglePowerEeReadout
                  thetaDeg={effectiveBeamOffset}
                  showFormula={beat.id === 'consequence'}
                  primaryBeat={beat.id === 'consequence' ? beat : undefined}
                />
              )}
            </div>
          </aside>
        </section>
      </div>

      {isMobileTransportManaged && !mobileTransportRevealed && (
        <button
          type="button"
          className="golden-flow-transport-reveal-btn"
          data-control-id="reveal-transport"
          onClick={() => setMobileTransportRevealed(true)}
          aria-label="顯示控制台"
          data-testid="transport-reveal-button"
        >
          控制台
        </button>
      )}

      <div
        className={`golden-flow-transport-container ${isMobileTransportHidden ? 'is-mobile-autohidden' : ''}`}
        inert={isMobileTransportHidden ? true : undefined}
        data-transport-mobile-inert={isMobileTransportHidden ? 'true' : 'false'}
      >
        {isMobileTransportManaged && mobileTransportRevealed && (
          <button
            type="button"
            className="golden-flow-transport-dismiss-btn"
            data-control-id="hide-transport"
            onClick={() => setMobileTransportRevealed(false)}
            aria-label="隱藏控制台"
            data-testid="transport-dismiss-button"
          >
            ✕ 隱藏
          </button>
        )}
        <TeachingAnimationTransport
          currentTimeSec={courseTimeSec}
          durationSec={segmentDurationSec}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          forceVisible={mobileTransportRevealed}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onStepBackward={handleStepBackward}
          onStepForward={handleStepForward}
          onSpeedChange={handleSpeedChange}
          stepSeconds={5}
          testId="teaching-transport"
        />
      </div>
      <span className="golden-flow-accessible-status" aria-live="polite">
        第 {segmentBeatIndex + 1} 段，共 {segmentBeatCount} 段；標準長度 {segment.id === 'full' ? GOLDEN_FLOW_NOMINAL_DURATION_SEC : goldenFlowSegmentDurationSec(segment)} 秒。
      </span>
    </main>
  );
}
