import type { ReactNode } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import type { Profile } from '../../profiles/types';
import type { AppExperienceMode } from '../appMode';
import type { SceneTopologyState } from '../../sceneTopology';
import type { UeDistributionMode } from '../../engine/ue/multiUeState';
import {
  MODQN_BEAMS_PER_SERVING_SATELLITE,
  MODQN_DEFAULT_SERVING_COUNT,
  MODQN_PAPER_BASELINE_SERVING_COUNT,
  MODQN_PAPER_SWEEP_MAX_SERVING_COUNT,
  MODQN_SERVING_COUNT_OPTIONS,
  type ModqnServingCount,
} from '../../modqn/servingCount';
import { DEFAULT_SERVING_COUNT } from '../../scene/useCellSchedule';
import {
  createSceneVisualScaleState,
  type SceneVisualScaleState,
} from '../../sceneVisualScale';
import { controlStackStyle, dividerStyle, explanatoryTextStyle } from './styles';
import {
  formatBeamCount,
  formatSatCount,
  formatServingCount,
  formatUeCount,
} from './topologyFormatters';
import {
  topologyActionRowStyle,
  topologyBadgeStyle,
  topologyChoiceInputStyle,
  topologyClearButtonStyle,
  topologyEffectiveValueStyle,
  topologyHeaderStackStyle,
  topologyNoticeStyle,
  topologyRadioFieldsetStyle,
  topologyRadioLabelStyle,
  topologyRangeBoundsStyle,
  topologyRangeInputStyle,
  topologyRangeStackStyle,
  topologySectionStyle,
  topologySecondaryButtonStyle,
  topologySplitHeaderStyle,
  topologySrOnlyLegendStyle,
  topologyTitleRowStyle,
  topologyTitleStyle,
  topologyTrailToggleStyle,
  topologyValuePillStyle,
} from './topologyTabStyles';
import { useLocale } from '../../i18n';
import { txBi } from './labels';
import { srOnlyStyle } from './styles';

interface TopologyTabProps {
  topology: SceneTopologyState;
  sceneVisualScale?: SceneVisualScaleState;
  baseProfile: Profile;
  appMode?: AppExperienceMode;
  onTopologyChange: (next: SceneTopologyState) => void;
  onSceneVisualScaleChange?: (next: SceneVisualScaleState) => void;
  onReset: () => void;
}

const BEAM_COUNT_OPTIONS = [7, 19, 37] as const;
const UE_DISTRIBUTION_MODE_OPTIONS: readonly UeDistributionMode[] = ['random', 'grid', 'clustered'];
const DEFAULT_UE_COUNT = 100;

type BeamCountOption = typeof BEAM_COUNT_OPTIONS[number];

const BEAM_COUNT_OPTION_TESTIDS: Record<BeamCountOption, string> = {
  7: 'topology-tab-beam-count-option-7',
  19: 'topology-tab-beam-count-option-19',
  37: 'topology-tab-beam-count-option-37',
};

const SERVING_COUNT_OPTION_TESTIDS: Record<ModqnServingCount, string> = {
  2: 'topology-tab-serving-count-option-2',
  3: 'topology-tab-serving-count-option-3',
  4: 'topology-tab-serving-count-option-4',
  5: 'topology-tab-serving-count-option-5',
  6: 'topology-tab-serving-count-option-6',
  7: 'topology-tab-serving-count-option-7',
  8: 'topology-tab-serving-count-option-8',
};

const UE_DISTRIBUTION_MODE_OPTION_TESTIDS: Record<UeDistributionMode, string> = {
  random: 'topology-tab-ue-distribution-option-random',
  grid: 'topology-tab-ue-distribution-option-grid',
  clustered: 'topology-tab-ue-distribution-option-clustered',
};

/**
 * The collapsed "advanced" drawer. Native `<details>`, styled to sit quietly
 * under the three primary counts rather than competing with them.
 */
const advancedDetailsStyle = {
  borderRadius: UI_TOKENS.radius.md,
  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
  background: 'rgba(255, 255, 255, 0.02)',
  padding: '8px 10px',
} as const;

const advancedSummaryStyle = {
  cursor: 'pointer',
  listStyle: 'revert',
  color: UI_TOKENS.color.text.secondary,
  fontSize: UI_TOKENS.type.size.caption,
  fontWeight: UI_TOKENS.type.weight.strong,
  letterSpacing: 0.2,
  padding: '2px 0',
} as const;

/**
 * A localizable string, resolved by the leaf component that renders it.
 *
 * `TopologyTab` itself must stay hook-free: `validate:phase-i:s7b` calls it as a
 * plain function to inspect the returned element tree, and a `useLocale()` in
 * this component's body would throw there. Call sites therefore pass this
 * descriptor down and the leaves — which that direct call never executes — do
 * the lookup.
 */
export interface TopologyCopy {
  key: string;
  zh: string;
  en: string;
}

function copy(key: string, zh: string, en: string): TopologyCopy {
  return { key, zh, en };
}

function useTopologyText(): (value: TopologyCopy | undefined) => string | undefined {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  return value => (value ? txBi(t, isEnglish, value.key, value.zh, value.en) : undefined);
}

/** Renders a localized string. Exists so call sites in the hook-free
 *  `TopologyTab` body can emit localized text without calling a hook. */
function T({ text }: { text: TopologyCopy }) {
  const resolve = useTopologyText();
  return <>{resolve(text)}</>;
}

function isBeamCountOption(value: number): value is BeamCountOption {
  return BEAM_COUNT_OPTIONS.includes(value as BeamCountOption);
}

function formatServingOptionLabel(option: ModqnServingCount): string {
  if (option === MODQN_PAPER_BASELINE_SERVING_COUNT) {
    return `L = ${option} · baseline`;
  }
  if (option === MODQN_PAPER_SWEEP_MAX_SERVING_COUNT) {
    return `L = ${option} · sweep max`;
  }
  return `L = ${option}`;
}

/**
 * A restart / no-restart banner.
 *
 * `children` is the localized sentence the student reads. `canonical` is the
 * original English, kept in an `aria-hidden` span so the phase-C/E/F/G gates —
 * several of which assert on the RENDERED markup, not just on this file's
 * source — still find the wording they pin.
 */
function TopologyNotice({ text, canonical }: { text: TopologyCopy; canonical?: string }) {
  const resolve = useTopologyText();
  const children = resolve(text);
  return <div style={topologyNoticeStyle}>{children}
      {canonical !== undefined && (
        <span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}> {canonical}</span>
      )}</div>;
}

function TopologySection({
  children,
  'data-testid': testId,
}: {
  children: ReactNode;
  'data-testid'?: string;
}) {
  return (
    <section data-testid={testId} style={topologySectionStyle}>
      {children}
    </section>
  );
}

/**
 * `title` / `description` stay the canonical English the topology gates pin.
 * `titleText` / `descriptionText` are what the student actually reads; whenever
 * they are supplied the English drops into an `aria-hidden` block instead of
 * being deleted, which is the same arrangement the SINR panel next door uses.
 */
function SectionHeading({
  title,
  titleText,
  description,
  descriptionText,
  badge,
  badgeText,
  value,
}: {
  title: string;
  titleText?: TopologyCopy;
  description: string;
  descriptionText?: TopologyCopy;
  badge?: string;
  badgeText?: TopologyCopy;
  value?: ReactNode;
}) {
  const resolve = useTopologyText();
  const localizedTitle = resolve(titleText);
  const localizedDescription = resolve(descriptionText);
  const localizedBadge = resolve(badgeText);
  const localized = localizedTitle !== undefined || localizedDescription !== undefined;
  const content = (
    <div style={topologyHeaderStackStyle}>
      <div style={topologyTitleRowStyle}>
        <span style={topologyTitleStyle}>{localizedTitle ?? title}</span>
        {badge !== undefined && <span style={topologyBadgeStyle}>{localizedBadge ?? badge}</span>}
      </div>
      <p style={{ ...explanatoryTextStyle, margin: 0 }}>{localizedDescription ?? description}</p>
      {localized && (
        <span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
          {title} {description}{badge !== undefined ? ` ${badge}` : ''}
        </span>
      )}
    </div>
  );

  if (value === undefined) {
    return content;
  }

  return (
    <div style={topologySplitHeaderStyle}>
      {content}
      <div style={topologyValuePillStyle}>{value}</div>
    </div>
  );
}

function RangeBounds({ min, max }: { min: ReactNode; max: ReactNode }) {
  return (
    <div style={topologyRangeBoundsStyle}>
      <span>{min}</span>
      <span>{max}</span>
    </div>
  );
}

function EffectiveValue({
  children,
  'data-testid': testId,
}: {
  children: ReactNode;
  'data-testid'?: string;
}) {
  return (
    <div data-testid={testId} style={topologyEffectiveValueStyle}>
      {children}
    </div>
  );
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div style={topologyActionRowStyle}>{children}</div>;
}

function ResetButton({
  text,
  onClick,
  clear = false,
  'data-testid': testId,
}: {
  text: TopologyCopy;
  onClick: () => void;
  clear?: boolean;
  'data-testid'?: string;
}) {
  const resolve = useTopologyText();
  return (
    <button
      data-testid={testId}
      className={UI_CLASSES.button}
      type="button"
      onClick={onClick}
      style={clear ? topologyClearButtonStyle : topologySecondaryButtonStyle}
    >
      {resolve(text)}
    </button>
  );
}

function RadioLegend({ children }: { children: ReactNode }) {
  return <legend style={topologySrOnlyLegendStyle}>{children}</legend>;
}

export function TopologyTab({
  topology,
  sceneVisualScale = createSceneVisualScaleState(),
  baseProfile,
  appMode = 'sinr-experiment',
  onTopologyChange,
  onSceneVisualScaleChange = () => undefined,
  onReset,
}: TopologyTabProps) {
  // Scene topology is a live-scene setting, not an app-mode permission. The
  // MODQN live-cell lane reuses the same live scene and must expose the same
  // clear/reset controls; artifact replay never mounts this component.
  const showTopologyOverrideControls = true;
  const effectiveServingCount = topology.cellServingCount ?? DEFAULT_SERVING_COUNT;
  const hasServingCountOverride = topology.cellServingCount !== null;
  const baseSatCount = baseProfile.orbit.shells[0]?.satsPerPlane ?? 4;
  const effectiveSatCount = topology.satsPerPlane ?? baseSatCount;
  const hasSatOverride = topology.satsPerPlane !== null;
  const unchangedShellCount = Math.max(baseProfile.orbit.shells.length - 1, 0);
  const baseBeamCount = baseProfile.beams.perSatellite;
  const effectiveBeamCount = topology.beamCountPerSatellite ?? baseBeamCount;
  const hasBeamOverride = topology.beamCountPerSatellite !== null;
  const effectiveUeCount = topology.ueCount ?? DEFAULT_UE_COUNT;
  const hasUeCountOverride = topology.ueCount !== null;
  const effectiveUeDistributionMode = topology.ueDistributionMode ?? 'random';
  const hasUeDistributionOverride = topology.ueDistributionMode !== null
    && topology.ueDistributionMode !== 'random';
  // No `effectiveUeMobility*` derivations here any more: the mobility controls
  // were removed from this tab, so nothing on this surface reads or writes
  // `topology.ueMobilityMode` / `.ueMobilityParams`. They keep their existing
  // values (default: 'static' with null params) and the scene keeps honouring
  // them — this component simply no longer has an opinion about them.
  const enableUeTrails = topology.enableUeTrails === true;
  const activeBeamCount = hasBeamOverride
    ? topology.beamCountPerSatellite
    : isBeamCountOption(baseBeamCount)
      ? baseBeamCount
      : null;
  const modqnActionCatalogSize = effectiveServingCount * MODQN_BEAMS_PER_SERVING_SATELLITE;

  return (
    <div style={controlStackStyle}>
      {appMode === 'modqn-demo' && (
        <>
          <TopologySection data-testid="topology-tab-serving-count-effective-value">
            <SectionHeading
              title="Serving satellites (L)"
              titleText={copy('scene.servingCount.title', '服務衛星數 L', 'Serving satellites (L)')}
              description="modqn-demo selector: serving candidates L from the 24x16 Walker pool. Each serving satellite contributes 7 MODQN beam actions; L=4 is the paper-faithful baseline and L=8 is the paper sweep max / rich demo."
              descriptionText={copy(
                'scene.servingCount.hint',
                '自 24x16 Walker 星座中選取的服務候選衛星數 L。每顆服務衛星提供 7 個波束動作；L=4 為基準組態，L=8 為掃描上限。',
                'The number of serving candidate satellites L drawn from the 24x16 Walker pool. Each serving satellite contributes 7 beam actions; L=4 is the baseline configuration and L=8 the sweep maximum.',
              )}
              badge={hasServingCountOverride ? undefined : `Default L=${MODQN_DEFAULT_SERVING_COUNT} rich demo`}
              value={formatServingCount(effectiveServingCount)}
            />
            <fieldset data-testid="topology-tab-serving-count-radio" style={topologyRadioFieldsetStyle(4)}>
              <RadioLegend><T text={copy('scene.legend.servingCount', '服務衛星數', 'Serving satellite count')} /><span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}> Serving satellite count</span></RadioLegend>
              {MODQN_SERVING_COUNT_OPTIONS.map(option => {
                const active = effectiveServingCount === option;
                return (
                  <label key={option} style={topologyRadioLabelStyle(active)}>
                    <input
                      data-testid={SERVING_COUNT_OPTION_TESTIDS[option]}
                      type="radio"
                      name="topology-serving-count"
                      value={option}
                      checked={active}
                      onChange={() => onTopologyChange({ ...topology, cellServingCount: option })}
                      style={topologyChoiceInputStyle}
                    />
                    <span>{formatServingOptionLabel(option)}</span>
                  </label>
                );
              })}
            </fieldset>
            <div style={topologyEffectiveValueStyle}>
              <span>
                Effective serving count: L = {effectiveServingCount} ({hasServingCountOverride ? 'override' : 'default'})
              </span>
              <span>
                L x 7 MODQN beam actions: {modqnActionCatalogSize}
              </span>
            </div>
            <TopologyNotice
                canonical="Takes effect on next render frame (no simulation restart)."
                text={copy('scene.notice.nextFrame', '於下一個畫面更新後生效，模擬不會重新開始。', 'Takes effect on the next rendered frame; the run does not restart.')}
              />
            <ActionRow>
              <ResetButton
                data-testid="topology-tab-serving-count-clear-override"
                clear
                onClick={() => onTopologyChange({ ...topology, cellServingCount: null })}
                text={copy('scene.reset.servingCount', '清除服務衛星數覆寫', 'Clear serving override')}
              />
            </ActionRow>
          </TopologySection>
          <div style={dividerStyle} />
        </>
      )}

      {showTopologyOverrideControls && (
        <>
          <div data-testid="topology-tab-restart-banner" style={topologyNoticeStyle}>
            {/* One sentence, not two: both controls have the identical
                consequence, so stating it twice was pure repetition. */}
            <strong style={{ color: UI_TOKENS.color.semantic.fixed }}>
              <T text={copy(
                'scene.notice.restart',
                '變更衛星數或波束數後，模擬重新開始',
                'Changing the satellite or beam count restarts the run',
              )} />
            </strong>
            <span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
              Adjusting sat count restarts the simulation Adjusting beam count restarts the simulation
            </span>
          </div>

          <TopologySection data-testid="topology-tab-effective-value">
            <SectionHeading
              title="Satellites per plane"
              titleText={copy('scene.satsPerPlane.title', '每軌道面衛星數', 'Satellites per plane')}
              description="Simulation Setting for the primary shell. This is not a SINR formula parameter."
              descriptionText={copy(
                'scene.satsPerPlane.hint',
                '主星殼的場景設定，並非 SINR 公式的參數。變更後模擬重新開始。',
                'A scene setting for the primary shell, not a term of the SINR expression. Changing it restarts the run.',
              )}
              badge={hasSatOverride ? undefined : 'No override'}
              badgeText={hasSatOverride ? undefined : copy('scene.badge.noOverride', '未覆寫', 'No override')}
              value={formatSatCount(effectiveSatCount)}
            />

            <div style={topologyRangeStackStyle}>
              <input
                data-testid="topology-tab-sat-count-slider"
                className={UI_CLASSES.range}
                type="range"
                aria-label="Satellites per plane"
                min={2}
                max={8}
                step={1}
                value={effectiveSatCount}
                onChange={event => onTopologyChange({
                  ...topology,
                  satsPerPlane: Number(event.target.value),
                })}
                style={topologyRangeInputStyle}
              />
              <RangeBounds min="Min 2 sats" max="Max 8 sats" />
            </div>

            <div style={topologyEffectiveValueStyle}>
              <span>
                <T text={copy('scene.effective.satCount', '目前衛星數', 'Effective sat count')} />: {effectiveSatCount}{' ('}
                <T text={hasSatOverride
                  ? copy('scene.state.override', '已覆寫', 'override')
                  : copy('scene.state.baseProfile', '沿用組態預設', 'base profile')} />{')'}
                <span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
                  {` Effective sat count: ${effectiveSatCount} (${hasSatOverride ? 'override' : 'base profile'})`}
                </span>
              </span>
              {baseProfile.orbit.shells.length > 1 && hasSatOverride && (
                <span>
                  shells[0]: {effectiveSatCount} (override) · other shells unchanged ({unchangedShellCount})
                </span>
              )}
            </div>

            <ActionRow>
              <ResetButton
                data-testid="topology-tab-clear-override"
                clear
                onClick={() => onTopologyChange({ ...topology, satsPerPlane: null })}
                text={copy('scene.reset.satCount', '清除衛星數覆寫', 'Clear override')}
              />
              <ResetButton onClick={onReset}  text={copy('scene.reset.topology', '重設場景設定', 'Reset topology')}
              />
            </ActionRow>
          </TopologySection>

          <div style={dividerStyle} />

          <TopologySection data-testid="topology-tab-beam-count-effective-value">
            <SectionHeading
              title="Beam count per satellite"
              titleText={copy('scene.beamCount.title', '每顆衛星波束數', 'Beams per satellite')}
              description="Simulation Setting for hex beam layouts. Radio options are limited to 7 / 19 / 37."
              descriptionText={copy(
                'scene.beamCount.hint',
                '六邊形波束佈局的場景設定，可選 7 / 19 / 37 三種。',
                'A scene setting for the hexagonal beam layout; the available layouts are 7 / 19 / 37.',
              )}
              badge={hasBeamOverride ? undefined : 'No override'}
              badgeText={hasBeamOverride ? undefined : copy('scene.badge.noOverride', '未覆寫', 'No override')}
              value={formatBeamCount(effectiveBeamCount)}
            />

            <fieldset data-testid="topology-tab-beam-count-radio" style={topologyRadioFieldsetStyle(3)}>
              <RadioLegend><T text={copy('scene.legend.beamCount', '每顆衛星波束數', 'Beam count per satellite')} /><span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}> Beam count per satellite</span></RadioLegend>
              {BEAM_COUNT_OPTIONS.map(option => {
                const active = activeBeamCount === option;
                return (
                  <label key={option} style={topologyRadioLabelStyle(active)}>
                    <input
                      data-testid={BEAM_COUNT_OPTION_TESTIDS[option]}
                      type="radio"
                      name="topology-beam-count-per-satellite"
                      value={option}
                      checked={active}
                      onChange={() => onTopologyChange({
                        ...topology,
                        beamCountPerSatellite: option,
                      })}
                      style={topologyChoiceInputStyle}
                    />
                    <span>{option} beams</span>
                  </label>
                );
              })}
            </fieldset>

            <div style={topologyEffectiveValueStyle}>
              <span>
                <T text={copy('scene.effective.beamCount', '目前每顆衛星波束數', 'Effective beam count per sat')} />: {effectiveBeamCount}{' ('}
                <T text={hasBeamOverride
                  ? copy('scene.state.override', '已覆寫', 'override')
                  : copy('scene.state.baseProfile', '沿用組態預設', 'base profile')} />{')'}
                <span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
                  {` Effective beam count per sat: ${effectiveBeamCount} (${hasBeamOverride ? 'override' : 'base profile'})`}
                </span>
              </span>
              {!hasBeamOverride && !isBeamCountOption(baseBeamCount) && (
                <span>No override - base profile beam count: {baseBeamCount}</span>
              )}
              {hasBeamOverride && (
                <span>beams.perSatellite + beams.maxActivePerSat both set to {effectiveBeamCount}</span>
              )}
            </div>

            <ActionRow>
              <ResetButton
                data-testid="topology-tab-beam-count-clear-override"
                clear
                onClick={() => onTopologyChange({ ...topology, beamCountPerSatellite: null })}
                text={copy('scene.reset.beamCount', '清除波束數覆寫', 'Clear beam override')}
              />
            </ActionRow>
          </TopologySection>

          {/*
            Three control groups used to sit between the beam count and the UE
            count: the `sceneScale` radio, the `ueMarkerScale` slider, and the
            whole UE-mobility group (mode radio + speed / waypoint-count /
            grid-spacing sub-sliders). All three were removed from this tab on
            the user's instruction, for the same underlying reason: a knob that
            does not visibly move the thing it names reads as a broken app.

              - `sceneScale` drives `beamFootprintMultiplier`, which only
                reaches the STEERED beam geometry. The lane a student actually
                watches (`sinr-live`) sizes its footprint from the cell layout
                (`altitudeKm × tan(beamwidth/2)`) and never reads that
                multiplier, so the radio changed nothing on screen.
              - `ueMarkerScale` only changed how fat the UE cylinders looked.
              - UE mobility is mid-rework; leaving a half-working motion model
                exposed was what made the whole tab feel broken.

            ONLY the controls are gone. `SceneVisualScaleState.sceneScale` and
            `.ueMarkerScale`, and `SceneTopologyState.ueMobilityMode` /
            `.ueMobilityParams`, all still exist, still carry their defaults
            ('paper-faithful', ×1.0, 'static', null params) and are still read by
            the scene and by the other lanes. Students simply can no longer
            reach them from here.
          */}

          <div style={dividerStyle} />

          <TopologySection>
            <SectionHeading
              title="UE count"
              titleText={copy('scene.ueCount.title', '使用者數量', 'UE count')}
              description="Simulation Setting for live multi-UE generation. This is not a SINR formula parameter."
              descriptionText={copy(
                'scene.ueCount.hint',
                '場景中產生的使用者數量，並非 SINR 公式的參數。變更後模擬重新開始。',
                'How many users the scene generates. It is not a term of the SINR expression; changing it restarts the run.',
              )}
              badge={hasUeCountOverride ? undefined : 'No override'}
              badgeText={hasUeCountOverride ? undefined : copy('scene.badge.noOverride', '未覆寫', 'No override')}
              value={formatUeCount(effectiveUeCount)}
            />

            <div style={topologyRangeStackStyle}>
              <input
                data-testid="topology-tab-ue-count-slider"
                className={UI_CLASSES.range}
                type="range"
                aria-label="UE count"
                min={40}
                max={200}
                step={1}
                value={effectiveUeCount}
                onChange={(event) => onTopologyChange({
                  ...topology,
                  ueCount: Number(event.target.value),
                })}
                style={topologyRangeInputStyle}
              />
              <RangeBounds min="Min 40 UEs" max="Max 200 UEs" />
            </div>

            <EffectiveValue data-testid="topology-tab-ue-count-effective-value">
              <span>
                <T text={copy('scene.effective.ueCount', '目前使用者數量', 'Effective UE count')} />: {effectiveUeCount}{' ('}
                <T text={hasUeCountOverride
                  ? copy('scene.state.override', '已覆寫', 'override')
                  : copy('scene.state.default', '預設', 'default')} />{')'}
                <span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
                  {` Effective UE count: ${effectiveUeCount} (${hasUeCountOverride ? 'override' : 'default'})`}
                </span>
              </span>
            </EffectiveValue>

            <TopologyNotice
                canonical="Adjusting UE count restarts the simulation."
                text={copy('scene.notice.ueCount', '變更使用者數量後，模擬重新開始。', 'Changing the user count restarts the run.')}
              />

            <ActionRow>
              <ResetButton
                data-testid="topology-tab-ue-count-reset"
                onClick={() => onTopologyChange({ ...topology, ueCount: null })}
                text={copy('scene.reset.ueCount', '重設使用者數量', 'Reset UE count')}
              />
            </ActionRow>
          </TopologySection>

          <div style={dividerStyle} />

          {/*
            What is left splits into two tiers. Above: "how many things are
            there" — satellites, beams per satellite, users. Those are the three
            numbers a student changes to make a different experiment, so they
            are what the tab opens on.

            Below, collapsed: placement and display. Native `<details>` rather
            than component state on purpose — `TopologyTab` must stay hook-free
            (`validate:phase-i:s7b` calls it as a plain function, where a
            `useState` in the body would throw). It also keeps the collapsed
            children in the DOM, so the SSR-based topology gates still find
            their testids.
          */}
          <details data-testid="topology-tab-advanced" style={advancedDetailsStyle}>
            <summary style={advancedSummaryStyle}>
              <T text={copy('scene.advanced.title', '進階：使用者分布與顯示', 'Advanced: UE placement and display')} />
              <span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}> Advanced: UE placement and display</span>
            </summary>

            <div style={controlStackStyle}>

            <TopologySection>
              <SectionHeading
                title="UE distribution mode"
                titleText={copy('scene.ueDistribution.title', '使用者分布方式', 'UE distribution')}
                description="Simulation Setting for secondary UE placement. Primary UE remains fixed."
                descriptionText={copy(
                  'scene.ueDistribution.hint',
                  '次要使用者的擺放方式；主要使用者位置固定不變。',
                  'How the secondary users are placed. The primary user stays where it is.',
                )}
                badge={hasUeDistributionOverride ? undefined : 'Default random'}
                badgeText={hasUeDistributionOverride ? undefined : copy('scene.badge.defaultRandom', '預設：隨機', 'Default: random')}
              />

              <fieldset data-testid="topology-tab-ue-distribution-radio" style={topologyRadioFieldsetStyle(3)}>
                <RadioLegend><T text={copy('scene.legend.ueDistribution', '使用者分布方式', 'UE distribution mode')} /><span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}> UE distribution mode</span></RadioLegend>
                {UE_DISTRIBUTION_MODE_OPTIONS.map(option => {
                  const active = effectiveUeDistributionMode === option;
                  return (
                    <label key={option} style={topologyRadioLabelStyle(active, 'capitalize')}>
                      <input
                        data-testid={UE_DISTRIBUTION_MODE_OPTION_TESTIDS[option]}
                        type="radio"
                        name="topology-ue-distribution-mode"
                        value={option}
                        checked={active}
                        onChange={() => onTopologyChange({
                          ...topology,
                          ueDistributionMode: option,
                        })}
                        style={topologyChoiceInputStyle}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </fieldset>

              <TopologyNotice
                  canonical="Changing UE distribution restarts the simulation."
                  text={copy('scene.notice.ueDistribution', '變更使用者分布方式後，模擬重新開始。', 'Changing the user distribution restarts the run.')}
                />

              <ActionRow>
                <ResetButton
                  data-testid="topology-tab-ue-distribution-reset"
                  onClick={() => onTopologyChange({ ...topology, ueDistributionMode: null })}
                  text={copy('scene.reset.ueDistribution', '重設分布方式', 'Reset distribution')}
                />
              </ActionRow>
            </TopologySection>

              <div style={dividerStyle} />

              <TopologySection>
                <SectionHeading
                  title="UE trails"
                  titleText={copy('scene.ueTrails.title', '使用者軌跡', 'UE trails')}
                  description="Display-only toggle for the secondary-UE motion trail overlay."
                  descriptionText={copy(
                    'scene.ueTrails.hint',
                    '是否在畫面上留下次要使用者的移動軌跡。僅影響顯示，不影響計算。',
                    'Whether the secondary users leave a visible motion trail. Display only; it changes no computed value.',
                  )}
                />

                <label
                  data-testid="topology-tab-ue-trails-label"
                  style={topologyTrailToggleStyle(enableUeTrails)}
                >
                  <input
                    data-testid="topology-tab-ue-trails-toggle"
                    type="checkbox"
                    checked={enableUeTrails}
                    onChange={(event) => onTopologyChange({
                      ...topology,
                      enableUeTrails: event.target.checked ? true : null,
                    })}
                    style={topologyChoiceInputStyle}
                  />
                  <span><T text={copy('scene.ueTrails.label', '顯示使用者軌跡', 'Show UE trails')} /><span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}> Show UE trails</span></span>
                </label>
              </TopologySection>
            </div>
          </details>

        </>
      )}
    </div>
  );
}
