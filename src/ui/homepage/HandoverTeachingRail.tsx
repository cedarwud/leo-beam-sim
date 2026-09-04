import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

import {
  buildHandoverTeachingScript,
  resolveTeachingFrame,
  teachingScriptTotalSec,
  teachingEeRatio01,
  TEACHING_EE_THRESHOLD_KBIT_PER_JOULE,
  type TeachingFrame,
  type TeachingHandoverKind,
  type TeachingIdentityBinding,
  type TeachingLinkFrame,
} from '../../homepage/teaching/handoverTeachingScript';
import { useLocale } from '../../i18n';

/**
 * The homepage handover lecture, rendered onto the existing shell.
 *
 * The 3D scene keeps running untouched in the centre: it is the diagram, and
 * the lecture attaches its authored numbers to the spacecraft the viewer can
 * actually see there. Only the right rail changes, plus one narration line
 * above the timeline, so nothing covers the render.
 *
 * One frame feeds the rail, the step chips, and the caption, so they cannot
 * disagree with each other. The numbers are authored teaching data and the
 * badge says so; the identities are live.
 */

const COLORS = {
  panel: '#06131b',
  soft: 'rgba(255,255,255,0.045)',
  line: 'rgba(218,244,255,0.16)',
  text: '#f1fbff',
  quiet: 'rgba(229,244,251,0.66)',
  accent: '#76ead7',
  warn: '#ffd78a',
  danger: '#ff9a9a',
} as const;

/**
 * Step labels are per kind. A same-satellite run has no rival spacecraft, so
 * naming its second step after one describes an inter handover the viewer is
 * not being shown.
 */
function stepLabels(kind: TeachingHandoverKind, isEnglish: boolean): readonly string[] {
  if (isEnglish) {
    return kind === 'intra'
      ? ['Serving', 'Candidate beam', 'Condition check', 'Beam re-point', 'Settled']
      : ['Serving', 'Candidate satellite', 'Condition check', 'Transfer', 'Settled'];
  }
  return kind === 'intra'
    ? ['服務中', '候選波束', '條件判定', '波束重指向', '完成']
    : ['服務中', '候選衛星', '條件判定', '換手執行', '完成'];
}

// One shared mapping with the scene's teaching cones; see teachingEeRatio01.
const eeRatio01 = teachingEeRatio01;

/** One wall-clock lecture clock, shared by the rail and the caption. */
export function useHandoverTeachingLecture(
  kind: TeachingHandoverKind | null,
  binding: TeachingIdentityBinding | null,
): {
  readonly frame: TeachingFrame | null;
  readonly totalSec: number;
  readonly paused: boolean;
  readonly setPaused: (next: boolean) => void;
  readonly restart: () => void;
  /** Changes on every arm and every restart, so one-shot side effects re-arm. */
  readonly runId: number;
} {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [paused, setPaused] = useState(false);
  const [runId, setRunId] = useState(0);
  const lastTickRef = useRef<number | null>(null);
  const script = kind === null ? null : buildHandoverTeachingScript(kind);
  const totalSec = script === null ? 0 : teachingScriptTotalSec(script);

  useEffect(() => {
    setElapsedSec(0);
    setPaused(false);
    setRunId(current => current + 1);
    lastTickRef.current = null;
  }, [kind]);

  useEffect(() => {
    if (kind === null || paused) { lastTickRef.current = null; return; }
    let frameId = 0;
    const tick = (nowMs: number): void => {
      const last = lastTickRef.current;
      lastTickRef.current = nowMs;
      if (last !== null) {
        const deltaSec = Math.min(0.25, (nowMs - last) / 1000);
        setElapsedSec(current => Math.min(totalSec, current + deltaSec));
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [kind, paused, totalSec]);

  const restart = useCallback(() => {
    setElapsedSec(0);
    lastTickRef.current = null;
    setPaused(false);
    setRunId(current => current + 1);
  }, []);

  return {
    frame: script === null ? null : resolveTeachingFrame(script, elapsedSec, binding),
    totalSec,
    paused,
    setPaused,
    restart,
    runId,
  };
}

function LinkRow({ link, isEnglish, kind }: {
  readonly link: TeachingLinkFrame;
  readonly isEnglish: boolean;
  readonly kind: TeachingHandoverKind;
}) {
  const ratio = eeRatio01(link.eeKbitPerJoule);
  const thresholdRatio = eeRatio01(TEACHING_EE_THRESHOLD_KBIT_PER_JOULE);
  return (
    <div
      data-testid="teaching-link-row"
      data-link-id={link.id}
      data-link-satellite-id={link.satelliteLabel}
      data-link-serving={link.isServing ? 'true' : 'false'}
      data-link-eligible={link.eligible ? 'true' : 'false'}
      data-link-ee-kbit-per-joule={link.eeKbitPerJoule.toFixed(1)}
      style={{
        display: 'grid', gap: 5, padding: '9px 10px', borderRadius: 8,
        border: `1px solid ${link.isServing ? link.color : COLORS.line}`,
        borderInlineStart: `5px solid ${link.color}`,
        background: link.isServing ? 'rgba(255,255,255,.06)' : 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        {/* Same-satellite rows lead with the beam, because the spacecraft is the
            constant and the beam is what changes; cross-satellite rows lead with
            the spacecraft, because that is what changes. Without this the two
            lectures render an identical-looking rail. */}
        <span style={{ fontSize: 16, fontWeight: 800, minWidth: 0, overflowWrap: 'anywhere' }}>
          {kind === 'intra' && !link.isServing ? (
            // The group heading above already establishes that these rows are
            // the serving satellite's other beams, so the row shows the beam
            // alone.
            <span style={{ color: link.color, opacity: 0.45 + 0.55 * ratio }}>{link.beamLabel}</span>
          ) : (
            <>
              {link.satelliteLabel}
              <span style={{ color: COLORS.quiet, fontWeight: 600 }}> {link.beamLabel}</span>
            </>
          )}
        </span>
        <span style={{
          flex: '0 0 auto', fontSize: 13.5, fontWeight: 800,
          color: link.isServing ? link.color : link.eligible ? COLORS.accent : COLORS.quiet,
        }}>
          {link.isServing ? (isEnglish ? 'Serving' : '服務中')
            : link.eligible ? (isEnglish ? 'Eligible' : '合格候選')
              : (isEnglish ? 'Below floor' : '未達閾值')}
        </span>
      </div>
      <div style={{ position: 'relative', height: 11, borderRadius: 6, background: 'rgba(2,16,24,.8)' }}>
        <span style={{
          position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, borderRadius: 6,
          // Colour strength tracks energy efficiency continuously, so a link
          // that is losing efficiency visibly fades and the replacement
          // visibly strengthens. Floored so a low-EE row stays legible.
          width: `${ratio * 100}%`, background: link.color,
          opacity: 0.28 + 0.72 * ratio,
        }} />
        <span style={{
          position: 'absolute', top: -3, bottom: -3,
          insetInlineStart: `${thresholdRatio * 100}%`, width: 2, background: COLORS.danger,
        }} />
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', fontSize: 14,
        color: COLORS.quiet, fontVariantNumeric: 'tabular-nums',
      }}>
        <span style={{ color: COLORS.text, fontWeight: 800, fontSize: 19 }}>
          {link.eeKbitPerJoule.toFixed(0)} <span style={{ fontSize: 13, fontWeight: 600 }}>Kbit/J</span>
        </span>
        <span>{isEnglish ? 'elev' : '仰角'} {link.elevationDeg.toFixed(0)}°</span>
      </div>
    </div>
  );
}

function Condition({ ok, label }: { readonly ok: boolean; readonly label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 17, lineHeight: 1.5 }}>
      <span aria-hidden="true" style={{
        flex: '0 0 auto', width: 19, height: 19, borderRadius: 5, display: 'grid', placeItems: 'center',
        background: ok ? 'rgba(118,234,215,.18)' : 'rgba(255,154,154,.14)',
        color: ok ? COLORS.accent : COLORS.danger, fontWeight: 900, fontSize: 13.5,
      }}>{ok ? '✓' : '✕'}</span>
      <span style={{ color: ok ? COLORS.text : COLORS.quiet }}>{label}</span>
    </div>
  );
}

export interface HandoverTeachingRailProps {
  readonly frame: TeachingFrame;
  readonly kind: TeachingHandoverKind;
  readonly totalSec: number;
  readonly paused: boolean;
  readonly onPausedChange: (next: boolean) => void;
  readonly onRestart: () => void;
  readonly onClose: () => void;
}

export function HandoverTeachingRail({
  frame, kind, totalSec, paused, onPausedChange, onRestart, onClose,
}: HandoverTeachingRailProps) {
  const { locale } = useLocale();
  const isEnglish = locale === 'en';
  const script = buildHandoverTeachingScript(kind);
  const button: CSSProperties = {
    flex: '1 1 auto', padding: '7px 10px', borderRadius: 7, border: `1px solid ${COLORS.line}`,
    background: 'rgba(255,255,255,.06)', color: COLORS.text, font: 'inherit',
    fontSize: 14.5, fontWeight: 700, cursor: 'pointer', minHeight: 40,
  };

  return (
    <section
      data-testid="handover-teaching-rail"
      data-teaching-kind={kind}
      data-teaching-phase={frame.phase.id}
      data-teaching-step-index={String(frame.phase.stepIndex)}
      data-teaching-elapsed-sec={frame.elapsedSec.toFixed(2)}
      data-teaching-total-sec={totalSec.toFixed(2)}
      data-teaching-serving-below-threshold={frame.servingBelowThreshold ? 'true' : 'false'}
      data-teaching-blocked={frame.blockedByThreshold ? 'true' : 'false'}
      data-teaching-committed={frame.committed ? 'true' : 'false'}
      aria-label={isEnglish ? script.titleEn : script.titleZhHant}
      style={{
        display: 'grid', gap: 9, alignContent: 'start', minWidth: 0, minHeight: 0,
        height: '100%', overflowY: 'auto', padding: 13, borderRadius: 10,
        border: `1px solid ${COLORS.line}`, background: COLORS.panel, color: COLORS.text,
        font: '15.5px/1.55 "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'grid', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <strong style={{ fontSize: 19 }}>{isEnglish ? script.titleEn : script.titleZhHant}</strong>
          <span style={{ fontSize: 12, color: COLORS.quiet, fontVariantNumeric: 'tabular-nums' }}>
            {frame.elapsedSec.toFixed(0)} / {totalSec.toFixed(0)} s
          </span>
        </div>
        <span style={{
          justifySelf: 'start', padding: '3px 8px', borderRadius: 999, fontSize: 13, fontWeight: 800,
          color: COLORS.warn, background: 'rgba(255,190,69,.12)', border: '1px solid rgba(255,190,69,.45)',
        }}>
          {isEnglish ? 'AUTHORED TEACHING VALUES · NOT MEASURED' : '教學用模擬數值 · 非實測'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={button} data-testid="teaching-pause"
            onClick={() => onPausedChange(!paused)}>
            {paused ? (isEnglish ? '▶ Play' : '▶ 播放') : (isEnglish ? '⏸ Pause' : '⏸ 暫停')}
          </button>
          <button type="button" style={button} data-testid="teaching-restart" onClick={onRestart}>
            {isEnglish ? '↻ Restart' : '↻ 重播'}
          </button>
          <button type="button" data-testid="teaching-close" onClick={onClose}
            style={{ ...button, borderColor: COLORS.accent, color: COLORS.accent }}>
            {isEnglish ? '✕ Exit' : '✕ 結束'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.quiet, letterSpacing: '.06em' }}>
          {isEnglish ? 'ENERGY EFFICIENCY · Kbit/J' : '能源效率 · Kbit/J'}
        </span>
        <span style={{ fontSize: 14.5, color: COLORS.danger, fontWeight: 700 }}>
          {isEnglish ? 'Handover floor' : '換手閾值'} {TEACHING_EE_THRESHOLD_KBIT_PER_JOULE} Kbit/J
        </span>
      </div>
      {frame.links.map((link, index) => (
        <div key={link.id} style={{ display: 'grid', gap: 6 }}>
          {index === 1 && (
            <span style={{
              marginTop: 2, fontSize: 13, fontWeight: 800,
              color: COLORS.quiet, letterSpacing: '.04em',
            }}>
              {kind === 'intra'
                ? (isEnglish ? 'SAME SATELLITE · OTHER BEAMS' : '同一衛星 · 其他波束')
                : (isEnglish ? 'OTHER SATELLITES · CANDIDATES' : '其他衛星 · 候選')}
            </span>
          )}
          <LinkRow link={link} isEnglish={isEnglish} kind={kind} />
        </div>
      ))}

      <div style={{
        display: 'grid', gap: 6, padding: 10, borderRadius: 8,
        border: `1px solid ${COLORS.line}`, background: COLORS.soft,
      }} data-testid="teaching-conditions">
        <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.quiet, letterSpacing: '.06em' }}>
          {isEnglish ? 'HANDOVER CONDITIONS' : '換手條件'}
        </span>
        <Condition ok={frame.winner.eligible}
          label={isEnglish ? '① Replacement clears the floor' : '① 候選本身高於閾值'} />
        <Condition ok={frame.servingBelowThreshold}
          label={isEnglish ? '② Serving has fallen below the floor' : '② 服務已跌破閾值'} />
        <Condition ok={frame.replacementLeads}
          label={isEnglish ? '③ Replacement beats serving' : '③ 候選優於服務'} />
        <Condition ok={frame.tttElapsedSec >= frame.tttSec}
          label={isEnglish
            ? `④ Held for ${frame.tttSec}s (${Math.min(frame.tttElapsedSec, frame.tttSec).toFixed(2)}s)`
            : `④ 持續滿 ${frame.tttSec} 秒（${Math.min(frame.tttElapsedSec, frame.tttSec).toFixed(2)} 秒）`} />
      </div>

      {frame.committed && (
        <div style={{
          display: 'grid', gap: 4, padding: 10, borderRadius: 8,
          border: `1px solid ${COLORS.accent}`, background: 'rgba(118,234,215,.08)',
        }} data-testid="teaching-receipt">
          <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.accent, letterSpacing: '.06em' }}>
            {isEnglish ? 'HANDOVER RECEIPT' : '換手收據'}
          </span>
          {([
            [isEnglish ? 'EE gain' : 'EE 增益',
              `+${(frame.winner.eeKbitPerJoule - frame.serving.eeKbitPerJoule).toFixed(0)} Kbit/J`],
            [isEnglish ? 'Interruption' : '中斷時間', `${script.receipt.interruptionMs} ms`],
            [isEnglish ? 'Signalling' : '訊令',
              `${script.receipt.signallingMessages} ${isEnglish ? 'msgs' : '則'}`],
          ] as const).map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15.5 }}>
              <span>{label}</span>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
            </div>
          ))}
          <p style={{ margin: '2px 0 0', fontSize: 14, lineHeight: 1.55, color: COLORS.quiet }}>
            {isEnglish ? script.receipt.costNoteEn : script.receipt.costNoteZhHant}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }} data-testid="teaching-steps">
        {stepLabels(kind, isEnglish).map((label, index) => {
          const done = index <= frame.phase.stepIndex;
          return (
            <span key={label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
              borderRadius: 999, fontSize: 14, fontWeight: 800,
              color: done ? COLORS.accent : COLORS.quiet,
              border: `1px solid ${done ? 'rgba(118,234,215,.5)' : COLORS.line}`,
              background: done ? 'rgba(118,234,215,.10)' : 'transparent',
            }}>
              <span aria-hidden="true" style={{
                display: 'inline-grid', placeItems: 'center', width: 16, height: 16,
                borderRadius: '50%', border: '1px solid currentColor', fontSize: 11.5,
              }}>{index + 1}</span>
              {label}
            </span>
          );
        })}
      </div>
    </section>
  );
}

/** The one-to-two narration lines that sit above the timeline. */
export function HandoverTeachingCaption({ frame }: { readonly frame: TeachingFrame }) {
  const { locale } = useLocale();
  const isEnglish = locale === 'en';
  return (
    <div
      data-testid="handover-teaching-caption"
      data-teaching-phase={frame.phase.id}
      style={{
        position: 'absolute', insetInlineStart: 18, insetInlineEnd: 18, bottom: 146, zIndex: 19,
        display: 'grid', gap: 2, padding: '9px 12px', borderRadius: 9, maxWidth: 1040,
        marginInline: 'auto', pointerEvents: 'none',
        borderInlineStart: `4px solid ${COLORS.accent}`, background: 'rgba(4,18,25,.94)',
        font: '19px/1.6 "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif',
        color: COLORS.text, boxShadow: '0 10px 28px rgba(0,0,0,.38)',
      }}
    >
      <strong style={{ fontSize: 15, color: COLORS.accent }}>
        {isEnglish ? frame.phase.eventLabelEn : frame.phase.eventLabelZhHant}
      </strong>
      <span>{isEnglish ? frame.phase.narrationEn : frame.phase.narrationZhHant}</span>
    </div>
  );
}
