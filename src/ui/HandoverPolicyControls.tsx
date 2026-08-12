/**
 * Handover timing controls.
 *
 * Two things a student changes often sit at the top; the six timers and limits
 * that only matter once you are chasing a specific ping-pong pattern are kept,
 * unchanged, inside a collapsed "more settings" block. Nothing was deleted —
 * the six still edit the same fields they always did.
 *
 * On-screen rule, shared with the SINR panel next door: a control row shows its
 * LABEL, its VALUE and its UNIT, and nothing else. The definition, the "what
 * changes if I move this" sentence, and the range/applied-value metadata are
 * all served from one "?" (`HelpPopover`, `placement="left"`). The per-row
 * `<details>What this changes</details>` block that used to print two English
 * paragraphs under every slider is gone.
 *
 * The canonical English term / description / effect for each row is NOT
 * deleted: it moves into an `aria-hidden`, visually-hidden `canonical-copy`
 * block, exactly as `signal-tuning/Controls.tsx` does it. The student reads the
 * localized popover; `validate:phase6b` still has the English terms to pin; and
 * a screen reader is not read the same sentence twice in two languages.
 *
 * Apply / Reset / the read-only policy pill are gone from the surface: slider
 * edits now take effect on their own (see LIVE_APPLY_SETTLE_MS below), so a
 * separate "commit" step no longer has anything to commit.
 *
 * Scope note for anyone extending this file: these values decide WHICH
 * satellite/beam serves the legacy Walker link. They do not own the archived-
 * TLE analysis frame or any EE power input and are intentionally not mounted in
 * the homepage parameter rail.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../constants/uiTokens';
import { useLocale } from '../i18n';
import type { HandoverPolicyTuningState } from '../handoverPolicyTuning';
import { HelpPopover } from './common/HelpPopover';
import { txBi } from './signal-tuning/labels';
import { srOnlyStyle } from './signal-tuning/styles';

type NumericHandoverPolicyField = Exclude<keyof HandoverPolicyTuningState, 'policy' | 'modqnWeights' | 'modqnNetworkParams'>;

/**
 * How long the panel waits, after the last slider movement, before applying.
 *
 * It is NOT a cosmetic debounce. Two facts force it:
 *
 *  1. `App.handleApplyHandoverPolicy` reads the `handoverPolicyDraft` that was
 *     derived during the render that built it (App.tsx:837-850). Calling
 *     `onDraftChange(next)` and `onApply()` back-to-back inside one `onChange`
 *     therefore applies the PREVIOUS draft and — because apply also writes
 *     `draft: nextApplied` — throws the user's edit away entirely; the slider
 *     springs back. Applying from an effect instead means `onApply` is the
 *     NEXT render's closure, which does hold the new value.
 *  2. That same handler runs `setSimState(createInitialSimState(...))`, i.e.
 *     every apply restarts the simulation at t=0. Firing it per drag tick would
 *     restart the scene dozens of times across one slider drag.
 *
 * So: draft on every movement (the slider tracks the finger, the readout is
 * live), apply once the value has settled.
 */
const LIVE_APPLY_SETTLE_MS = 250;

interface PolicyControlHelpCopy {
  /** App-unique help id: becomes data-testid="help-popover-trigger-<id>". */
  helpId: string;
  labelKey: string;
  labelZh: string;
  labelEn: string;
  bodyKey: string;
  bodyZh: string;
  bodyEn: string;
  effectKey: string;
  effectZh: string;
  effectEn: string;
}

interface HandoverPolicyControlConfig {
  field: NumericHandoverPolicyField;
  /** Canonical English term. Drives the slider aria-label; kept in canonical copy. */
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Canonical English "what is this". Surfaced through the "?". */
  description: string;
  /** Canonical English "what changes if I move it". Surfaced through the "?". */
  effect: string;
  /** Every row carries a "?" now — this is no longer optional. */
  help: PolicyControlHelpCopy;
}

interface HandoverPolicyControlsProps {
  draft: HandoverPolicyTuningState;
  applied: HandoverPolicyTuningState;
  hasDraftChanges: boolean;
  /**
   * Still part of the props contract App passes, but no longer read here: the
   * "Reset to profile defaults" button it used to enable/disable is gone.
   */
  hasOverrides: boolean;
  onDraftChange: (next: HandoverPolicyTuningState) => void;
  onApply: () => void;
  /** Same: kept in the contract, no longer bound to a control in this panel. */
  onReset: () => void;
}

/** The two values that answer "how readily does the link hand over?" — always visible. */
const PRIMARY_POLICY_CONTROL_CONFIGS: readonly HandoverPolicyControlConfig[] = [
  {
    field: 'offsetDb',
    label: 'Handover offset margin',
    unit: 'dB',
    min: 0,
    max: 10,
    step: 0.25,
    description: 'Candidate target must beat the current link by this margin before inter-satellite handover can progress.',
    effect: 'Lower is more aggressive; higher is stickier.',
    help: {
      helpId: 'param.handoverOffsetDb',
      labelKey: 'param.handoverOffsetDb.label',
      labelZh: '換手偏移門檻',
      labelEn: 'Handover offset margin',
      bodyKey: 'param.handoverOffsetDb.help',
      bodyZh: '候選衛星的 SINR 須高於目前服務衛星達此 dB 差值，才會被列為換手候選。設為 0 表示只要略優即納入評估。',
      bodyEn: 'A candidate satellite must exceed the serving satellite by this many dB before it qualifies as a handover candidate. At 0, any advantage at all qualifies.',
      effectKey: 'param.handoverOffsetDb.effect',
      effectZh: '調低：換手次數增加，連線可能在兩顆衛星間反覆切換。調高：服務衛星維持較久，但訊號可能先劣化才換手。',
      effectEn: 'Lower values increase the handover rate and allow the link to alternate between two satellites. Higher values hold the serving satellite longer, at the cost of letting the link degrade first.',
    },
  },
  {
    field: 'triggerTimeSec',
    label: 'Inter-HO trigger time',
    unit: 's',
    min: 0,
    max: 15,
    step: 0.25,
    description: 'Stable pending-target dwell before inter-satellite handover commits.',
    effect: 'Longer dwell reduces fast switching at the cost of slower response.',
    help: {
      helpId: 'param.handoverTriggerTimeSec',
      labelKey: 'param.handoverTriggerTimeSec.label',
      labelZh: '換手觸發持續時間',
      labelEn: 'Inter-HO trigger time',
      bodyKey: 'param.handoverTriggerTimeSec.help',
      bodyZh: '候選衛星須連續維持超過偏移門檻達此秒數，才實際執行換手。用於濾除短時的訊號起伏。',
      bodyEn: 'A candidate must stay above the offset margin continuously for this many seconds before the handover is executed. It filters out short-lived signal fluctuations.',
      effectKey: 'param.handoverTriggerTimeSec.effect',
      effectZh: '調低：反應較快，但易受短時起伏影響。調高：僅在持續改善時換手，反應時間變長。',
      effectEn: 'Lower values respond faster but are more sensitive to brief fluctuations. Higher values commit only to a sustained improvement, at the cost of response time.',
    },
  },
];

/**
 * Kept, not deleted: the timers and limits used when the question is a specific
 * behaviour (ping-pong, beam churn) rather than overall handover readiness.
 * Collapsed by default.
 */
const ADVANCED_POLICY_CONTROL_CONFIGS: readonly HandoverPolicyControlConfig[] = [
  {
    field: 'pingPongGuardSec',
    label: 'Ping-pong guard window',
    unit: 's',
    min: 0,
    max: 30,
    step: 0.5,
    description: 'Cooldown after inter-satellite handover to reduce immediate switching back.',
    effect: 'Longer guard windows make the manager less willing to reverse a recent handover.',
    help: {
      helpId: 'param.handoverPingPongGuardSec',
      labelKey: 'param.handoverPingPongGuardSec.label',
      labelZh: '乒乓保護窗長',
      labelEn: 'Ping-pong guard window',
      bodyKey: 'param.handoverPingPongGuardSec.help',
      bodyZh: '完成跨衛星換手後的冷卻時間。此窗內不再換回原服務衛星，用於抑制來回往返的換手。',
      bodyEn: 'A cooldown that starts after an inter-satellite handover. Within this window the link does not switch back to the previous satellite, which suppresses back-and-forth handovers.',
      effectKey: 'param.handoverPingPongGuardSec.effect',
      effectZh: '調高：較不易撤銷剛完成的換手，但也較晚修正誤判。調低：修正較快，往返換手增加。',
      effectEn: 'Higher values make the manager less willing to reverse a recent handover, but also slower to correct a bad one. Lower values correct faster and allow more back-and-forth.',
    },
  },
  {
    field: 'sinrSmoothingSec',
    label: 'Decision SINR smoothing',
    unit: 's',
    min: 0,
    max: 5,
    step: 0.1,
    description: 'Decision-path smoothing for candidate link samples; 0 uses the raw per-frame value.',
    effect: 'More smoothing dampens momentary spikes before they affect the handover state machine.',
    help: {
      helpId: 'param.handoverSinrSmoothingSec',
      labelKey: 'param.handoverSinrSmoothingSec.label',
      labelZh: '決策 SINR 平滑窗長',
      labelEn: 'Decision SINR smoothing',
      bodyKey: 'param.handoverSinrSmoothingSec.help',
      bodyZh: '換手決策所用的 SINR 取樣平滑時間窗。設為 0 表示直接採用每一影格的原始值。此參數只影響決策路徑，不改變畫面上顯示的 SINR。',
      bodyEn: 'The averaging window applied to the SINR samples the handover decision reads. At 0 the raw per-frame value is used. It affects the decision path only; the SINR shown on screen is unchanged.',
      effectKey: 'param.handoverSinrSmoothingSec.effect',
      effectZh: '調高：短暫尖峰不會立即驅動狀態機，但對真實變化的反應變慢。調低：反應快，易受單一影格雜訊影響。',
      effectEn: 'Higher values keep momentary spikes from driving the state machine, at the cost of reacting more slowly to a real change. Lower values react quickly but are sensitive to single-frame noise.',
    },
  },
  {
    field: 'intraSwitchTimeSec',
    label: 'Same-satellite beam dwell',
    unit: 's',
    min: 0,
    max: 5,
    step: 0.1,
    description: 'Dwell before switching beams on the same satellite.',
    effect: 'Shorter dwell tracks beam quality faster; longer dwell avoids frequent beam changes.',
    help: {
      helpId: 'param.handoverIntraSwitchTimeSec',
      labelKey: 'param.handoverIntraSwitchTimeSec.label',
      labelZh: '同衛星波束停留時間',
      labelEn: 'Same-satellite beam dwell',
      bodyKey: 'param.handoverIntraSwitchTimeSec.help',
      bodyZh: '在同一顆衛星上切換波束前，較佳波束須維持領先的時間。此為波束間（intra）換手，不更換服務衛星。',
      bodyEn: 'How long a better beam on the SAME satellite must stay ahead before the link moves to it. This is a beam-level (intra) handover; the serving satellite does not change.',
      effectKey: 'param.handoverIntraSwitchTimeSec.effect',
      effectZh: '調低：波束品質追蹤較即時，但波束切換次數增加。調高：波束較穩定，代價是短暫停留在較差的波束。',
      effectEn: 'Lower values track beam quality more closely at the cost of more beam changes. Higher values keep the beam stable, at the cost of dwelling briefly on a worse one.',
    },
  },
  {
    field: 'maxIntraSwitchesPerServingEpoch',
    label: 'Intra-HO limit per satellite',
    unit: 'switches',
    min: 0,
    max: 7,
    step: 1,
    description: 'Maximum same-satellite beam switches before the next inter-satellite handover resets the counter.',
    effect: 'Lower values stop local beam ping-pong; 0 disables intra-HO for the current serving-satellite epoch.',
    help: {
      helpId: 'param.handoverMaxIntraSwitches',
      labelKey: 'param.handoverMaxIntraSwitches.label',
      labelZh: '同衛星波束切換次數上限',
      labelEn: 'Intra-HO limit per satellite',
      bodyKey: 'param.handoverMaxIntraSwitches.help',
      bodyZh: '同一顆服務衛星期間內，允許的波束切換次數上限。計數器於下一次跨衛星換手時歸零。設為 0 表示此期間不進行波束切換。',
      bodyEn: 'The maximum number of beam switches allowed while one satellite is serving. The counter resets at the next inter-satellite handover. At 0, no beam switching happens during that period.',
      effectKey: 'param.handoverMaxIntraSwitches.effect',
      effectZh: '調低：抑制局部波束往返，但可能停留在非最佳波束。調高：追蹤最佳波束，波束切換次數增加。',
      effectEn: 'Lower values stop local beam ping-pong, at the cost of staying on a sub-optimal beam. Higher values follow the best beam, at the cost of more switching.',
    },
  },
  {
    field: 'pendingTargetHoldSec',
    label: 'Pending target hold',
    unit: 's',
    min: 0,
    max: 10,
    step: 0.25,
    description: 'Grace window before replacing a still-qualified pending target.',
    effect: 'Higher values keep a pending target stable when another option briefly looks better.',
    help: {
      helpId: 'param.handoverPendingTargetHoldSec',
      labelKey: 'param.handoverPendingTargetHoldSec.label',
      labelZh: '候選目標保留時間',
      labelEn: 'Pending target hold',
      bodyKey: 'param.handoverPendingTargetHoldSec.help',
      bodyZh: '已鎖定的候選目標在仍符合條件時的保留時間。此窗內即使另一顆衛星短暫勝出，也不更換候選目標。',
      bodyEn: 'How long an already-selected pending target is kept while it still qualifies. Within this window the target is not replaced even if another satellite briefly looks better.',
      effectKey: 'param.handoverPendingTargetHoldSec.effect',
      effectZh: '調高：候選目標較穩定，換手過程不易被短暫變化打斷。調低：更快改選當下最佳的候選目標。',
      effectEn: 'Higher values keep the pending target stable so a handover in progress is not interrupted by a brief change. Lower values re-select the currently best candidate sooner.',
    },
  },
  {
    field: 'sinrThresholdDb',
    label: 'Handover attach threshold',
    unit: 'dB',
    min: -20,
    max: 10,
    step: 0.5,
    description: 'Minimum attach and reattach eligibility level for the handover manager.',
    effect: 'This names the handover policy gate, not the DPC beam-power control field.',
    help: {
      helpId: 'param.handoverSinrThresholdDb',
      labelKey: 'param.handoverSinrThresholdDb.label',
      labelZh: '連線門檻',
      labelEn: 'Handover attach threshold',
      bodyKey: 'param.handoverSinrThresholdDb.help',
      bodyZh: '候選衛星可被接入或重新接入的最低 SINR。低於此值的衛星不列入換手評估。',
      bodyEn: 'The lowest SINR at which a satellite may be attached or re-attached. A satellite below this level is not considered for handover.',
      effectKey: 'param.handoverSinrThresholdDb.effect',
      effectZh: '調高：可用候選變少，弱連線較早被排除。調低：候選較多，但可能接上品質不足的連線。此門檻屬於換手判定，與波束功率控制無關。',
      effectEn: 'Higher values leave fewer usable candidates and rule out weak links earlier. Lower values keep more candidates but may attach a link that is too weak. This threshold belongs to the handover decision, not to beam-power control.',
    },
  },
];

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: '12px',
  borderRadius: UI_TOKENS.radius.lg,
  background: 'linear-gradient(180deg, rgba(6, 25, 35, 0.9), rgba(3, 10, 17, 0.82))',
  border: '1px solid rgba(118, 234, 215, 0.24)',
};

function formatPolicyValue(value: number, unit: string): string {
  if (unit === 'switches') {
    const count = Math.round(value);
    return `${count} ${count === 1 ? 'switch' : 'switches'}`;
  }
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)} ${unit}`;
}

function PolicyNumericControl({
  config,
  value,
  appliedValue,
  onChange,
}: {
  config: HandoverPolicyControlConfig;
  value: number;
  appliedValue: number;
  onChange: (value: number) => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const hasDraftChange = value !== appliedValue;
  const help = config.help;
  const label = say(help.labelKey, help.labelZh, help.labelEn);

  return (
    <article
      className="leo-policy-control-card"
      data-policy-field={config.field}
      data-draft-changed={hasDraftChange ? 'true' : 'false'}
    >
      <div className="leo-policy-control-heading">
        <div className="leo-policy-control-title-block">
          <div className="leo-policy-control-label">{label}</div>
        </div>
        <output className="leo-policy-control-value">
          {formatPolicyValue(value, config.unit)}
        </output>
        <HelpPopover
          helpId={help.helpId}
          titleText={label}
          bodyText={say(help.bodyKey, help.bodyZh, help.bodyEn)}
          effectText={say(help.effectKey, help.effectZh, help.effectEn)}
          meta={(
            <>
              <div>
                {say('common.unitLabel', '單位', 'Unit')}: {config.unit}
              </div>
              <div>
                {say('common.rangeLabel', '可調範圍', 'Range')}:{' '}
                {formatPolicyValue(config.min, config.unit)} – {formatPolicyValue(config.max, config.unit)}
              </div>
              <div>
                {say('common.appliedLabel', '目前套用值', 'Applied')}:{' '}
                {formatPolicyValue(appliedValue, config.unit)}
              </div>
            </>
          )}
          placement="left"
        />
      </div>
      <input
        className={UI_CLASSES.range}
        type="range"
        aria-label={`${config.label} (${config.unit})`}
        min={config.min}
        max={config.max}
        step={config.step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor: UI_TOKENS.color.semantic.candidate.accent }}
      />
      <div className="leo-policy-control-range">
        <span>{formatPolicyValue(config.min, config.unit)}</span>
        <span>{formatPolicyValue(config.max, config.unit)}</span>
      </div>
      {/*
        Canonical English term + explanation, kept in the DOM but off the
        screen. The student reads the localized "?" above; the provenance gates
        still have the English wording to pin; and because it is aria-hidden a
        screen reader is not read both languages back to back.
      */}
      <div
        aria-hidden="true"
        data-prominence="canonical-copy"
        data-testid={`policy-${config.field}-details`}
        style={srOnlyStyle}
      >
        <span>{config.label}</span>
        <span>{config.description}</span>
        <span>{config.effect}</span>
        <span>Applied {formatPolicyValue(appliedValue, config.unit)}</span>
      </div>
    </article>
  );
}

export function HandoverPolicyControls({
  draft,
  applied,
  hasDraftChanges,
  onDraftChange,
  onApply,
}: HandoverPolicyControlsProps) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Read through a ref so the timer below always calls the LATEST onApply — the
  // one whose closure holds the draft we just wrote. See LIVE_APPLY_SETTLE_MS.
  const applyRef = useRef(onApply);
  applyRef.current = onApply;

  useEffect(() => {
    if (!hasDraftChanges) return undefined;
    const timer = setTimeout(() => applyRef.current(), LIVE_APPLY_SETTLE_MS);
    return () => clearTimeout(timer);
    // `draft` restarts the timer on every movement, so one drag applies once.
  }, [hasDraftChanges, draft]);

  const updateNumber = (field: NumericHandoverPolicyField, value: number) => {
    onDraftChange({ ...draft, [field]: value });
  };

  const renderControl = (config: HandoverPolicyControlConfig) => (
    <PolicyNumericControl
      key={config.field}
      config={config}
      value={draft[config.field]}
      appliedValue={applied[config.field]}
      onChange={value => updateNumber(config.field, value)}
    />
  );

  const sectionTitle = say('section.handoverPolicy.title', '換手判定參數', 'Handover decision parameters');
  const advancedTitle = say(
    'section.handoverAdvanced.title',
    '進階：計時器與次數上限',
    'Advanced: timers and switch limits',
  );

  return (
    <section
      className="leo-handover-policy-controls"
      data-testid="handover-policy-controls"
      aria-label="Handover Policy Research Controls"
      style={sectionStyle}
    >
      <div className="leo-policy-section-header">
        <div className="leo-policy-section-title-row">
          <div
            className="leo-policy-section-title"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
          >
            <span>{sectionTitle}</span>
            <HelpPopover
              helpId="section.handoverPolicy"
              titleText={sectionTitle}
              bodyText={say(
                'section.handoverPolicy.hint',
                '本區參數決定連線在什麼條件下改由哪一顆衛星或哪一道波束服務。調整後立即生效並重新開始模擬。',
                'These parameters decide the conditions under which the link moves to another satellite or another beam. An edit takes effect on its own and restarts the run.',
              )}
              effectText={say(
                'section.handoverPolicy.scope',
                '此區僅影響換手判定與其計時，不改變 SINR 公式的任何一項，也不影響功率鏈與能源效率。',
                'This section affects handover qualification and its timers only. It changes no term of the SINR expression, and it does not enter the power train or energy efficiency.',
              )}
              placement="left"
            />
          </div>
          {/*
            Canonical English panel name, plus the applied policy id. Both were
            visible chrome before; they are kept in the DOM for anyone matching
            the panel by its documented title, but the student now sees only the
            parameters themselves.
          */}
          <span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
            Handover Policy Research Controls
          </span>
          <span
            aria-hidden="true"
            data-testid="handover-policy-readonly"
            data-prominence="canonical-copy"
            style={srOnlyStyle}
          >
            policy: {applied.policy} - read-only
          </span>
        </div>
      </div>

      <div className="leo-policy-control-list" data-testid="handover-policy-primary-controls">
        {PRIMARY_POLICY_CONTROL_CONFIGS.map(renderControl)}
      </div>

      <details
        className="leo-policy-control-details leo-policy-control-details--section"
        data-testid="handover-policy-advanced"
        open={advancedOpen}
        onToggle={event => setAdvancedOpen((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>{advancedTitle}</summary>
        {/* The paragraph that used to sit here is now this "?" — the disclosure
            opens onto controls, not onto prose. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6 }}>
          <HelpPopover
            helpId="section.handoverAdvanced"
            titleText={advancedTitle}
            bodyText={say(
              'section.handoverAdvanced.hint',
              '偏移門檻與觸發持續時間決定是否換手；此區六項參數設定換手前後的行為：換手後的冷卻時間、決策訊號的平滑窗長、同衛星波束切換的停留時間與次數上限。',
              'The offset margin and the trigger time decide whether a handover happens at all. These six parameters govern the behaviour around it: the cooldown after a handover, the smoothing window applied to the decision signal, and the dwell time and count limit for beam switches on the same satellite.',
            )}
            placement="left"
          />
        </div>
        <div className="leo-policy-control-list">
          {ADVANCED_POLICY_CONTROL_CONFIGS.map(renderControl)}
        </div>
      </details>
    </section>
  );
}
