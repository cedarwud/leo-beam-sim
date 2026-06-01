import type { ReactNode } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import type { Profile } from '../../profiles/types';
import type { AppExperienceMode } from '../appMode';
import type { SceneTopologyState } from '../../sceneTopology';
import type { UeDistributionMode } from '../../engine/ue/multiUeState';
import {
  DEFAULT_UE_MOBILITY_PARAMS,
  type UeMobilityMode,
  type UeMobilityParams,
} from '../../engine/ue/multiUeMobility';
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
  type SceneScale,
  type SceneVisualScaleState,
} from '../../sceneVisualScale';
import { controlStackStyle, dividerStyle, explanatoryTextStyle } from './styles';
import {
  formatBeamCount,
  formatGridSpacing,
  formatSatCount,
  formatServingCount,
  formatUeCount,
  formatUeSpeed,
  formatWaypointCount,
} from './topologyFormatters';
import {
  topologyActionRowStyle,
  topologyBadgeStyle,
  topologyChoiceInputStyle,
  topologyClearButtonStyle,
  topologyEffectiveValueStyle,
  topologyHeaderStackStyle,
  topologyNoticeStyle,
  topologyParamLabelStyle,
  topologyParamPanelStyle,
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
const SCENE_SCALE_OPTIONS: readonly SceneScale[] = ['paper-faithful', 'demo-readability'];
const UE_DISTRIBUTION_MODE_OPTIONS: readonly UeDistributionMode[] = ['random', 'grid', 'clustered'];
const UE_MOBILITY_MODE_OPTIONS: readonly UeMobilityMode[] = ['static', 'random-walk', 'waypoints', 'manhattan'];
const DEFAULT_UE_COUNT = 100;

const SCENE_SCALE_OPTION_TESTIDS: Record<SceneScale, string> = {
  'paper-faithful': 'topology-tab-scene-scale-option-paper-faithful',
  'demo-readability': 'topology-tab-scene-scale-option-demo-readability',
};

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

const UE_MOBILITY_MODE_OPTION_TESTIDS: Record<UeMobilityMode, string> = {
  static: 'topology-tab-ue-mobility-option-static',
  'random-walk': 'topology-tab-ue-mobility-option-random-walk',
  waypoints: 'topology-tab-ue-mobility-option-waypoints',
  manhattan: 'topology-tab-ue-mobility-option-manhattan',
};

const UE_MOBILITY_PARAM_TESTIDS = {
  speedKmPerSec: 'topology-tab-ue-mobility-speed',
  waypointCount: 'topology-tab-ue-mobility-waypoint-count',
  manhattanGridSpacingKm: 'topology-tab-ue-mobility-grid-spacing',
} as const;

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

function TopologyNotice({ children }: { children: ReactNode }) {
  return <div style={topologyNoticeStyle}>{children}</div>;
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

function SectionHeading({
  title,
  description,
  badge,
  value,
}: {
  title: string;
  description: string;
  badge?: string;
  value?: ReactNode;
}) {
  const content = (
    <div style={topologyHeaderStackStyle}>
      <div style={topologyTitleRowStyle}>
        <span style={topologyTitleStyle}>{title}</span>
        {badge !== undefined && <span style={topologyBadgeStyle}>{badge}</span>}
      </div>
      <p style={{ ...explanatoryTextStyle, margin: 0 }}>{description}</p>
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
  children,
  onClick,
  clear = false,
  'data-testid': testId,
}: {
  children: ReactNode;
  onClick: () => void;
  clear?: boolean;
  'data-testid'?: string;
}) {
  return (
    <button
      data-testid={testId}
      className={UI_CLASSES.button}
      type="button"
      onClick={onClick}
      style={clear ? topologyClearButtonStyle : topologySecondaryButtonStyle}
    >
      {children}
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
  const showTopologyOverrideControls = appMode === 'sinr-experiment';
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
  const effectiveUeMobilityMode = topology.ueMobilityMode ?? 'static';
  const effectiveUeMobilityParams = topology.ueMobilityParams ?? DEFAULT_UE_MOBILITY_PARAMS;
  const showUeMobilityParams = topology.ueMobilityMode !== null
    && topology.ueMobilityMode !== 'static';
  const hasUeMobilityOverride = topology.ueMobilityMode !== null
    && topology.ueMobilityMode !== 'static'
    || topology.ueMobilityParams !== null;
  const enableUeTrails = topology.enableUeTrails === true;
  const activeBeamCount = hasBeamOverride
    ? topology.beamCountPerSatellite
    : isBeamCountOption(baseBeamCount)
      ? baseBeamCount
      : null;
  const modqnActionCatalogSize = effectiveServingCount * MODQN_BEAMS_PER_SERVING_SATELLITE;
  const updateUeMobilityParams = (patch: Partial<UeMobilityParams>) => {
    onTopologyChange({
      ...topology,
      ueMobilityParams: {
        ...DEFAULT_UE_MOBILITY_PARAMS,
        ...(topology.ueMobilityParams ?? {}),
        ...patch,
      },
    });
  };

  return (
    <div style={controlStackStyle}>
      {appMode === 'modqn-demo' && (
        <>
          <TopologySection data-testid="topology-tab-serving-count-effective-value">
            <SectionHeading
              title="Serving satellites (L)"
              description="modqn-demo selector: serving candidates L from the 24x16 Walker pool. Each serving satellite contributes 7 MODQN beam actions; L=4 is the paper-faithful baseline and L=8 is the paper sweep max / rich demo."
              badge={hasServingCountOverride ? undefined : `Default L=${MODQN_DEFAULT_SERVING_COUNT} rich demo`}
              value={formatServingCount(effectiveServingCount)}
            />
            <fieldset data-testid="topology-tab-serving-count-radio" style={topologyRadioFieldsetStyle(4)}>
              <RadioLegend>Serving satellite count</RadioLegend>
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
            <TopologyNotice>Takes effect on next render frame (no simulation restart).</TopologyNotice>
            <ActionRow>
              <ResetButton
                data-testid="topology-tab-serving-count-clear-override"
                clear
                onClick={() => onTopologyChange({ ...topology, cellServingCount: null })}
              >
                Clear serving override
              </ResetButton>
            </ActionRow>
          </TopologySection>
          <div style={dividerStyle} />
        </>
      )}

      {showTopologyOverrideControls && (
        <>
          <div data-testid="topology-tab-restart-banner" style={topologyNoticeStyle}>
            <strong style={{ color: UI_TOKENS.color.semantic.fixed }}>
              Adjusting sat count restarts the simulation
            </strong>
            <span>Adjusting beam count restarts the simulation</span>
          </div>

          <TopologySection data-testid="topology-tab-effective-value">
            <SectionHeading
              title="Satellites per plane"
              description="Simulation Setting for the primary shell. This is not a SINR formula parameter."
              badge={hasSatOverride ? undefined : 'No override'}
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
                Effective sat count: {effectiveSatCount} ({hasSatOverride ? 'override' : 'base profile'})
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
              >
                Clear override
              </ResetButton>
              <ResetButton onClick={onReset}>Reset topology</ResetButton>
            </ActionRow>
          </TopologySection>

          <div style={dividerStyle} />

          <TopologySection data-testid="topology-tab-beam-count-effective-value">
            <SectionHeading
              title="Beam count per satellite"
              description="Simulation Setting for hex beam layouts. Radio options are limited to 7 / 19 / 37."
              badge={hasBeamOverride ? undefined : 'No override'}
              value={formatBeamCount(effectiveBeamCount)}
            />

            <fieldset data-testid="topology-tab-beam-count-radio" style={topologyRadioFieldsetStyle(3)}>
              <RadioLegend>Beam count per satellite</RadioLegend>
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
                Effective beam count per sat: {effectiveBeamCount} ({hasBeamOverride ? 'override' : 'base profile'})
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
              >
                Clear beam override
              </ResetButton>
            </ActionRow>
          </TopologySection>
        </>
      )}

      <div style={dividerStyle} />

      <TopologySection>
        <SectionHeading
          title="Scene scale"
          description="Simulation Setting for visual footprint scale. This is not a SINR formula parameter."
        />

        <fieldset data-testid="topology-tab-scene-scale-radio" style={topologyRadioFieldsetStyle(2)}>
          <RadioLegend>Scene scale</RadioLegend>
          {SCENE_SCALE_OPTIONS.map(option => {
            const active = sceneVisualScale.sceneScale === option;
            return (
              <label key={option} style={topologyRadioLabelStyle(active)}>
                <input
                  data-testid={SCENE_SCALE_OPTION_TESTIDS[option]}
                  type="radio"
                  name="topology-scene-scale"
                  value={option}
                  checked={active}
                  onChange={() => onSceneVisualScaleChange({
                    ...sceneVisualScale,
                    sceneScale: option,
                  })}
                  style={topologyChoiceInputStyle}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </fieldset>

        <TopologyNotice>
          Adjusting scene scale takes effect on next render frame (no simulation restart).
        </TopologyNotice>

        <EffectiveValue data-testid="topology-tab-scene-scale-effective-value">
          <span>
            Effective scene scale: {sceneVisualScale.sceneScale} ({sceneVisualScale.sceneScale !== 'paper-faithful' ? 'override' : 'default'})
          </span>
        </EffectiveValue>

        <ActionRow>
          <ResetButton
            data-testid="topology-tab-scene-scale-reset"
            onClick={() => onSceneVisualScaleChange(createSceneVisualScaleState())}
          >
            Reset visual scale
          </ResetButton>
        </ActionRow>
      </TopologySection>

      <div style={dividerStyle} />

      <TopologySection>
        <SectionHeading
          title="UE marker size"
          description="Visual-only size control for UE marker cylinders."
        />

        <div style={topologyRangeStackStyle}>
          <input
            data-testid="topology-tab-ue-marker-slider"
            className={UI_CLASSES.range}
            type="range"
            aria-label="UE marker size"
            min={0.5}
            max={3.0}
            step={0.1}
            value={sceneVisualScale.ueMarkerScale}
            onChange={(e) => onSceneVisualScaleChange({
              ...sceneVisualScale,
              ueMarkerScale: Number(e.target.value),
            })}
            style={topologyRangeInputStyle}
          />
          <RangeBounds min="0.5×" max="3.0×" />
        </div>

        <EffectiveValue data-testid="topology-tab-ue-marker-effective-value">
          <span>
            Effective UE marker scale: {sceneVisualScale.ueMarkerScale.toFixed(2)}×
          </span>
        </EffectiveValue>

        <p style={{ ...explanatoryTextStyle, margin: 0 }}>
          Adjusts UE marker cylinder size relative to the default. Takes effect on next render frame (no simulation restart).
        </p>

        <ActionRow>
          <ResetButton
            data-testid="topology-tab-ue-marker-reset"
            onClick={() => onSceneVisualScaleChange({
              ...sceneVisualScale,
              ueMarkerScale: 1.0,
            })}
          >
            Reset UE size
          </ResetButton>
        </ActionRow>
      </TopologySection>

      {showTopologyOverrideControls && (
        <>
          <div style={dividerStyle} />

          <TopologySection>
            <SectionHeading
              title="UE count"
              description="Simulation Setting for live multi-UE generation. This is not a SINR formula parameter."
              badge={hasUeCountOverride ? undefined : 'No override'}
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
                Effective UE count: {effectiveUeCount} ({hasUeCountOverride ? 'override' : 'default'})
              </span>
            </EffectiveValue>

            <TopologyNotice>Adjusting UE count restarts the simulation.</TopologyNotice>

            <ActionRow>
              <ResetButton
                data-testid="topology-tab-ue-count-reset"
                onClick={() => onTopologyChange({ ...topology, ueCount: null })}
              >
                Reset UE count
              </ResetButton>
            </ActionRow>
          </TopologySection>

          <div style={dividerStyle} />

          <TopologySection>
            <SectionHeading
              title="UE distribution mode"
              description="Simulation Setting for secondary UE placement. Primary UE remains fixed."
              badge={hasUeDistributionOverride ? undefined : 'Default random'}
            />

            <fieldset data-testid="topology-tab-ue-distribution-radio" style={topologyRadioFieldsetStyle(3)}>
              <RadioLegend>UE distribution mode</RadioLegend>
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

            <TopologyNotice>Changing UE distribution restarts the simulation.</TopologyNotice>

            <ActionRow>
              <ResetButton
                data-testid="topology-tab-ue-distribution-reset"
                onClick={() => onTopologyChange({ ...topology, ueDistributionMode: null })}
              >
                Reset distribution
              </ResetButton>
            </ActionRow>
          </TopologySection>

          <div style={dividerStyle} />

          <TopologySection>
            <SectionHeading
              title="UE mobility"
              description="Simulation Setting for secondary UE motion. Primary UE remains fixed."
              badge={hasUeMobilityOverride ? undefined : 'Default static'}
            />

            <fieldset data-testid="topology-tab-ue-mobility-radio" style={topologyRadioFieldsetStyle(4)}>
              <RadioLegend>UE mobility</RadioLegend>
              {UE_MOBILITY_MODE_OPTIONS.map(option => {
                const active = effectiveUeMobilityMode === option;
                return (
                  <label key={option} style={topologyRadioLabelStyle(active)}>
                    <input
                      data-testid={UE_MOBILITY_MODE_OPTION_TESTIDS[option]}
                      type="radio"
                      name="topology-ue-mobility-mode"
                      value={option}
                      checked={active}
                      onChange={() => onTopologyChange({
                        ...topology,
                        ueMobilityMode: option,
                        ueMobilityParams: option === 'static' ? null : topology.ueMobilityParams,
                      })}
                      style={topologyChoiceInputStyle}
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </fieldset>

            {showUeMobilityParams && (
              <div style={topologyParamPanelStyle}>
                <label style={{ display: 'grid', gap: 7 }}>
                  <span style={topologyParamLabelStyle}>
                    <span>Speed</span>
                    <span>{formatUeSpeed(effectiveUeMobilityParams.speedKmPerSec)}</span>
                  </span>
                  <input
                    data-testid={UE_MOBILITY_PARAM_TESTIDS.speedKmPerSec}
                    className={UI_CLASSES.range}
                    type="range"
                    aria-label="UE mobility speed"
                    min={1}
                    max={50}
                    step={1}
                    value={effectiveUeMobilityParams.speedKmPerSec}
                    onChange={event => updateUeMobilityParams({ speedKmPerSec: Number(event.target.value) })}
                    style={topologyRangeInputStyle}
                  />
                </label>

                {effectiveUeMobilityMode === 'waypoints' && (
                  <label style={{ display: 'grid', gap: 7 }}>
                    <span style={topologyParamLabelStyle}>
                      <span>Waypoint count</span>
                      <span>{formatWaypointCount(effectiveUeMobilityParams.waypointCount)}</span>
                    </span>
                    <input
                      data-testid={UE_MOBILITY_PARAM_TESTIDS.waypointCount}
                      className={UI_CLASSES.range}
                      type="range"
                      aria-label="UE mobility waypoint count"
                      min={2}
                      max={8}
                      step={1}
                      value={effectiveUeMobilityParams.waypointCount}
                      onChange={event => updateUeMobilityParams({ waypointCount: Number(event.target.value) })}
                      style={topologyRangeInputStyle}
                    />
                  </label>
                )}

                {effectiveUeMobilityMode === 'manhattan' && (
                  <label style={{ display: 'grid', gap: 7 }}>
                    <span style={topologyParamLabelStyle}>
                      <span>Grid spacing</span>
                      <span>{formatGridSpacing(effectiveUeMobilityParams.manhattanGridSpacingKm)}</span>
                    </span>
                    <input
                      data-testid={UE_MOBILITY_PARAM_TESTIDS.manhattanGridSpacingKm}
                      className={UI_CLASSES.range}
                      type="range"
                      aria-label="UE mobility Manhattan grid spacing"
                      min={1}
                      max={20}
                      step={1}
                      value={effectiveUeMobilityParams.manhattanGridSpacingKm}
                      onChange={event => updateUeMobilityParams({ manhattanGridSpacingKm: Number(event.target.value) })}
                      style={topologyRangeInputStyle}
                    />
                  </label>
                )}
              </div>
            )}

            <TopologyNotice>Changing UE mobility restarts the simulation.</TopologyNotice>

            <ActionRow>
              <ResetButton
                data-testid="topology-tab-ue-mobility-reset"
                onClick={() => onTopologyChange({ ...topology, ueMobilityMode: null, ueMobilityParams: null })}
              >
                Reset mobility
              </ResetButton>
            </ActionRow>

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
              <span>Show UE trails</span>
            </label>
          </TopologySection>
        </>
      )}
    </div>
  );
}
