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
  createSceneVisualScaleState,
  type SceneScale,
  type SceneVisualScaleState,
} from '../../sceneVisualScale';
import { controlStackStyle, dividerStyle, explanatoryTextStyle } from './styles';

interface TopologyTabProps {
  topology: SceneTopologyState;
  sceneVisualScale?: SceneVisualScaleState;
  baseProfile: Profile;
  appMode?: AppExperienceMode;
  onTopologyChange: (next: SceneTopologyState) => void;
  onSceneVisualScaleChange?: (next: SceneVisualScaleState) => void;
  onReset: () => void;
}

function formatSatCount(value: number): string {
  return `${value.toFixed(0)} sats`;
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

function formatBeamCount(value: number): string {
  return `${value.toFixed(0)} beams`;
}

function formatUeCount(value: number): string {
  return `${value.toFixed(0)} UEs`;
}

function formatUeSpeed(value: number): string {
  return `${value.toFixed(0)} km/sec`;
}

function formatWaypointCount(value: number): string {
  return `${value.toFixed(0)} waypoints`;
}

function formatGridSpacing(value: number): string {
  return `${value.toFixed(0)} km`;
}

function isBeamCountOption(value: number): value is BeamCountOption {
  return BEAM_COUNT_OPTIONS.includes(value as BeamCountOption);
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
      {showTopologyOverrideControls && (
        <>
          <div
            data-testid="topology-tab-restart-banner"
            style={{
              display: 'grid',
              gap: 4,
              padding: '10px 12px',
              borderRadius: UI_TOKENS.radius.md,
              background: 'rgba(255, 214, 125, 0.10)',
              border: '1px solid rgba(255, 214, 125, 0.24)',
              color: 'rgba(255, 231, 180, 0.9)',
              fontSize: UI_TOKENS.type.size.body,
              lineHeight: 1.4,
            }}
          >
            <strong style={{ color: UI_TOKENS.color.semantic.fixed }}>
              Adjusting sat count restarts the simulation
            </strong>
            <span>Adjusting beam count restarts the simulation</span>
          </div>

          <section
            data-testid="topology-tab-effective-value"
            style={{
              display: 'grid',
              gap: 12,
              padding: '14px 15px',
              borderRadius: UI_TOKENS.radius.lg,
              background: UI_TOKENS.color.surface.card,
              border: `1px solid ${UI_TOKENS.color.border.subtle}`,
              borderLeft: `4px solid ${UI_TOKENS.color.semantic.fixed}aa`,
            }}
          >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'start',
        }}>
          <div style={{ display: 'grid', gap: 5, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{
                color: UI_TOKENS.color.text.controlLabel,
                fontSize: UI_TOKENS.type.size.bodyLg,
                fontWeight: UI_TOKENS.type.weight.heavy,
                lineHeight: 1.3,
              }}>
                Satellites per plane
              </span>
              {!hasSatOverride && (
                <span style={{
                  padding: '3px 7px',
                  borderRadius: UI_TOKENS.radius.sm,
                  background: 'rgba(132, 148, 163, 0.12)',
                  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                  color: UI_TOKENS.color.text.secondary,
                  fontSize: UI_TOKENS.type.size.caption,
                  fontWeight: UI_TOKENS.type.weight.heavy,
                  textTransform: 'uppercase',
                }}>
                  No override
                </span>
              )}
            </div>
            <p style={{ ...explanatoryTextStyle, margin: 0 }}>
              Simulation Setting for the primary shell. This is not a SINR formula parameter.
            </p>
          </div>
          <div style={{
            padding: '6px 10px',
            borderRadius: UI_TOKENS.radius.md,
            background: 'rgba(255, 255, 255, 0.055)',
            border: `1px solid ${UI_TOKENS.color.semantic.fixed}38`,
            color: UI_TOKENS.color.text.primary,
            fontSize: UI_TOKENS.type.size.bodyLg,
            fontWeight: UI_TOKENS.type.weight.heavy,
            whiteSpace: 'nowrap',
          }}>
            {formatSatCount(effectiveSatCount)}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 7 }}>
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
            style={{
              width: '100%',
              accentColor: UI_TOKENS.color.semantic.fixed,
              cursor: 'pointer',
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.body,
            lineHeight: 1.35,
          }}>
            <span>Min 2 sats</span>
            <span>Max 8 sats</span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gap: 6,
          color: UI_TOKENS.color.text.secondary,
          fontSize: UI_TOKENS.type.size.body,
          lineHeight: 1.45,
        }}>
          <span>
            Effective sat count: {effectiveSatCount} ({hasSatOverride ? 'override' : 'base profile'})
          </span>
          {baseProfile.orbit.shells.length > 1 && hasSatOverride && (
            <span>
              shells[0]: {effectiveSatCount} (override) · other shells unchanged ({unchangedShellCount})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            data-testid="topology-tab-clear-override"
            className={UI_CLASSES.button}
            type="button"
            onClick={() => onTopologyChange({ ...topology, satsPerPlane: null })}
            style={{
              cursor: 'pointer',
              borderRadius: UI_TOKENS.radius.md,
              border: `1px solid ${UI_TOKENS.color.border.subtle}`,
              background: 'rgba(255, 255, 255, 0.055)',
              color: UI_TOKENS.color.text.secondary,
              padding: '8px 10px',
              fontSize: UI_TOKENS.type.size.body,
              fontWeight: UI_TOKENS.type.weight.strong,
            }}
          >
            Clear override
          </button>
          <button
            className={UI_CLASSES.button}
            type="button"
            onClick={onReset}
            style={{
              cursor: 'pointer',
              borderRadius: UI_TOKENS.radius.md,
              border: `1px solid ${UI_TOKENS.color.border.subtle}`,
              background: 'rgba(132, 148, 163, 0.08)',
              color: UI_TOKENS.color.text.secondary,
              padding: '8px 10px',
              fontSize: UI_TOKENS.type.size.body,
              fontWeight: UI_TOKENS.type.weight.strong,
            }}
          >
            Reset topology
          </button>
        </div>
          </section>

          <div style={dividerStyle} />

          <section
            data-testid="topology-tab-beam-count-effective-value"
            style={{
              display: 'grid',
              gap: 12,
              padding: '14px 15px',
              borderRadius: UI_TOKENS.radius.lg,
              background: UI_TOKENS.color.surface.card,
              border: `1px solid ${UI_TOKENS.color.border.subtle}`,
              borderLeft: `4px solid ${UI_TOKENS.color.semantic.fixed}aa`,
            }}
          >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'start',
        }}>
          <div style={{ display: 'grid', gap: 5, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{
                color: UI_TOKENS.color.text.controlLabel,
                fontSize: UI_TOKENS.type.size.bodyLg,
                fontWeight: UI_TOKENS.type.weight.heavy,
                lineHeight: 1.3,
              }}>
                Beam count per satellite
              </span>
              {!hasBeamOverride && (
                <span style={{
                  padding: '3px 7px',
                  borderRadius: UI_TOKENS.radius.sm,
                  background: 'rgba(132, 148, 163, 0.12)',
                  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                  color: UI_TOKENS.color.text.secondary,
                  fontSize: UI_TOKENS.type.size.caption,
                  fontWeight: UI_TOKENS.type.weight.heavy,
                  textTransform: 'uppercase',
                }}>
                  No override
                </span>
              )}
            </div>
            <p style={{ ...explanatoryTextStyle, margin: 0 }}>
              Simulation Setting for hex beam layouts. Radio options are limited to 7 / 19 / 37.
            </p>
          </div>
          <div style={{
            padding: '6px 10px',
            borderRadius: UI_TOKENS.radius.md,
            background: 'rgba(255, 255, 255, 0.055)',
            border: `1px solid ${UI_TOKENS.color.semantic.fixed}38`,
            color: UI_TOKENS.color.text.primary,
            fontSize: UI_TOKENS.type.size.bodyLg,
            fontWeight: UI_TOKENS.type.weight.heavy,
            whiteSpace: 'nowrap',
          }}>
            {formatBeamCount(effectiveBeamCount)}
          </div>
        </div>

        <fieldset
          data-testid="topology-tab-beam-count-radio"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
            padding: 0,
            margin: 0,
            border: 0,
            minWidth: 0,
          }}
        >
          <legend style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}>
            Beam count per satellite
          </legend>
          {BEAM_COUNT_OPTIONS.map(option => {
            const active = activeBeamCount === option;
            return (
              <label
                key={option}
                style={{
                  cursor: 'pointer',
                  display: 'grid',
                  gap: 5,
                  justifyItems: 'center',
                  padding: '10px 9px',
                  borderRadius: UI_TOKENS.radius.md,
                  border: `1px solid ${active ? `${UI_TOKENS.color.semantic.fixed}66` : UI_TOKENS.color.border.subtle}`,
                  background: active ? 'rgba(255, 214, 125, 0.12)' : 'rgba(255, 255, 255, 0.045)',
                  color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                  fontSize: UI_TOKENS.type.size.body,
                  fontWeight: UI_TOKENS.type.weight.strong,
                  lineHeight: 1.25,
                }}
              >
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
                  style={{
                    width: 16,
                    height: 16,
                    margin: 0,
                    accentColor: UI_TOKENS.color.semantic.fixed,
                    cursor: 'pointer',
                  }}
                />
                <span>{option} beams</span>
              </label>
            );
          })}
        </fieldset>

        <div style={{
          display: 'grid',
          gap: 6,
          color: UI_TOKENS.color.text.secondary,
          fontSize: UI_TOKENS.type.size.body,
          lineHeight: 1.45,
        }}>
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            data-testid="topology-tab-beam-count-clear-override"
            className={UI_CLASSES.button}
            type="button"
            onClick={() => onTopologyChange({ ...topology, beamCountPerSatellite: null })}
            style={{
              cursor: 'pointer',
              borderRadius: UI_TOKENS.radius.md,
              border: `1px solid ${UI_TOKENS.color.border.subtle}`,
              background: 'rgba(255, 255, 255, 0.055)',
              color: UI_TOKENS.color.text.secondary,
              padding: '8px 10px',
              fontSize: UI_TOKENS.type.size.body,
              fontWeight: UI_TOKENS.type.weight.strong,
            }}
          >
            Clear beam override
          </button>
        </div>
          </section>
        </>
      )}

      <div style={dividerStyle} />

      <section
        style={{
          display: 'grid',
          gap: 12,
          padding: '14px 15px',
          borderRadius: UI_TOKENS.radius.lg,
          background: UI_TOKENS.color.surface.card,
          border: `1px solid ${UI_TOKENS.color.border.subtle}`,
          borderLeft: `4px solid ${UI_TOKENS.color.semantic.fixed}aa`,
        }}
      >
        <div style={{
          display: 'grid',
          gap: 5,
          minWidth: 0,
        }}>
          <span style={{
            color: UI_TOKENS.color.text.controlLabel,
            fontSize: UI_TOKENS.type.size.bodyLg,
            fontWeight: UI_TOKENS.type.weight.heavy,
            lineHeight: 1.3,
          }}>
            Scene scale
          </span>
          <p style={{ ...explanatoryTextStyle, margin: 0 }}>
            Simulation Setting for visual footprint scale. This is not a SINR formula parameter.
          </p>
        </div>

        <fieldset
          data-testid="topology-tab-scene-scale-radio"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 8,
            padding: 0,
            margin: 0,
            border: 0,
            minWidth: 0,
          }}
        >
          <legend style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}>
            Scene scale
          </legend>
          {SCENE_SCALE_OPTIONS.map(option => {
            const active = sceneVisualScale.sceneScale === option;
            return (
              <label
                key={option}
                style={{
                  cursor: 'pointer',
                  display: 'grid',
                  gap: 5,
                  justifyItems: 'center',
                  padding: '10px 9px',
                  borderRadius: UI_TOKENS.radius.md,
                  border: `1px solid ${active ? `${UI_TOKENS.color.semantic.fixed}66` : UI_TOKENS.color.border.subtle}`,
                  background: active ? 'rgba(255, 214, 125, 0.12)' : 'rgba(255, 255, 255, 0.045)',
                  color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                  fontSize: UI_TOKENS.type.size.body,
                  fontWeight: UI_TOKENS.type.weight.strong,
                  lineHeight: 1.25,
                }}
              >
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
                  style={{
                    width: 16,
                    height: 16,
                    margin: 0,
                    accentColor: UI_TOKENS.color.semantic.fixed,
                    cursor: 'pointer',
                  }}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </fieldset>

        <div style={{
          padding: '10px 12px',
          borderRadius: UI_TOKENS.radius.md,
          background: 'rgba(255, 214, 125, 0.10)',
          border: '1px solid rgba(255, 214, 125, 0.24)',
          color: 'rgba(255, 231, 180, 0.9)',
          fontSize: UI_TOKENS.type.size.body,
          lineHeight: 1.4,
        }}>
          Adjusting scene scale takes effect on next render frame (no simulation restart).
        </div>

        <div
          data-testid="topology-tab-scene-scale-effective-value"
          style={{
            display: 'grid',
            gap: 6,
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.body,
            lineHeight: 1.45,
          }}
        >
          <span>
            Effective scene scale: {sceneVisualScale.sceneScale} ({sceneVisualScale.sceneScale !== 'paper-faithful' ? 'override' : 'default'})
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            data-testid="topology-tab-scene-scale-reset"
            className={UI_CLASSES.button}
            type="button"
            onClick={() => onSceneVisualScaleChange(createSceneVisualScaleState())}
            style={{
              cursor: 'pointer',
              borderRadius: UI_TOKENS.radius.md,
              border: `1px solid ${UI_TOKENS.color.border.subtle}`,
              background: 'rgba(132, 148, 163, 0.08)',
              color: UI_TOKENS.color.text.secondary,
              padding: '8px 10px',
              fontSize: UI_TOKENS.type.size.body,
              fontWeight: UI_TOKENS.type.weight.strong,
            }}
          >
            Reset visual scale
          </button>
        </div>
      </section>

      <div style={dividerStyle} />

      <section
        style={{
          display: 'grid',
          gap: 12,
          padding: '14px 15px',
          borderRadius: UI_TOKENS.radius.lg,
          background: UI_TOKENS.color.surface.card,
          border: `1px solid ${UI_TOKENS.color.border.subtle}`,
          borderLeft: `4px solid ${UI_TOKENS.color.semantic.fixed}aa`,
        }}
      >
        <div style={{
          display: 'grid',
          gap: 5,
          minWidth: 0,
        }}>
          <span style={{
            color: UI_TOKENS.color.text.controlLabel,
            fontSize: UI_TOKENS.type.size.bodyLg,
            fontWeight: UI_TOKENS.type.weight.heavy,
            lineHeight: 1.3,
          }}>
            UE marker size
          </span>
          <p style={{ ...explanatoryTextStyle, margin: 0 }}>
            Visual-only size control for UE marker cylinders.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 7 }}>
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
            style={{
              width: '100%',
              accentColor: UI_TOKENS.color.semantic.fixed,
              cursor: 'pointer',
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.body,
            lineHeight: 1.35,
          }}>
            <span>0.5×</span>
            <span>3.0×</span>
          </div>
        </div>

        <div
          data-testid="topology-tab-ue-marker-effective-value"
          style={{
            display: 'grid',
            gap: 6,
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.body,
            lineHeight: 1.45,
          }}
        >
          <span>
            Effective UE marker scale: {sceneVisualScale.ueMarkerScale.toFixed(2)}×
          </span>
        </div>

        <p style={{ ...explanatoryTextStyle, margin: 0 }}>
          Adjusts UE marker cylinder size relative to the default. Takes effect on next render frame (no simulation restart).
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            data-testid="topology-tab-ue-marker-reset"
            className={UI_CLASSES.button}
            type="button"
            onClick={() => onSceneVisualScaleChange({
              ...sceneVisualScale,
              ueMarkerScale: 1.0,
            })}
            style={{
              cursor: 'pointer',
              borderRadius: UI_TOKENS.radius.md,
              border: `1px solid ${UI_TOKENS.color.border.subtle}`,
              background: 'rgba(132, 148, 163, 0.08)',
              color: UI_TOKENS.color.text.secondary,
              padding: '8px 10px',
              fontSize: UI_TOKENS.type.size.body,
              fontWeight: UI_TOKENS.type.weight.strong,
            }}
          >
            Reset UE size
          </button>
        </div>
      </section>

      {showTopologyOverrideControls && (
        <>
          <div style={dividerStyle} />

          <section
            style={{
              display: 'grid',
              gap: 12,
              padding: '14px 15px',
              borderRadius: UI_TOKENS.radius.lg,
              background: UI_TOKENS.color.surface.card,
              border: `1px solid ${UI_TOKENS.color.border.subtle}`,
              borderLeft: `4px solid ${UI_TOKENS.color.semantic.fixed}aa`,
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'start',
            }}>
              <div style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{
                    color: UI_TOKENS.color.text.controlLabel,
                    fontSize: UI_TOKENS.type.size.bodyLg,
                    fontWeight: UI_TOKENS.type.weight.heavy,
                    lineHeight: 1.3,
                  }}>
                    UE count
                  </span>
                  {!hasUeCountOverride && (
                    <span style={{
                      padding: '3px 7px',
                      borderRadius: UI_TOKENS.radius.sm,
                      background: 'rgba(132, 148, 163, 0.12)',
                      border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                      color: UI_TOKENS.color.text.secondary,
                      fontSize: UI_TOKENS.type.size.caption,
                      fontWeight: UI_TOKENS.type.weight.heavy,
                      textTransform: 'uppercase',
                    }}>
                      No override
                    </span>
                  )}
                </div>
                <p style={{ ...explanatoryTextStyle, margin: 0 }}>
                  Simulation Setting for live multi-UE generation. This is not a SINR formula parameter.
                </p>
              </div>
              <div style={{
                padding: '6px 10px',
                borderRadius: UI_TOKENS.radius.md,
                background: 'rgba(255, 255, 255, 0.055)',
                border: `1px solid ${UI_TOKENS.color.semantic.fixed}38`,
                color: UI_TOKENS.color.text.primary,
                fontSize: UI_TOKENS.type.size.bodyLg,
                fontWeight: UI_TOKENS.type.weight.heavy,
                whiteSpace: 'nowrap',
              }}>
                {formatUeCount(effectiveUeCount)}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 7 }}>
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
                style={{
                  width: '100%',
                  accentColor: UI_TOKENS.color.semantic.fixed,
                  cursor: 'pointer',
                }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                color: UI_TOKENS.color.text.secondary,
                fontSize: UI_TOKENS.type.size.body,
                lineHeight: 1.35,
              }}>
                <span>Min 40 UEs</span>
                <span>Max 200 UEs</span>
              </div>
            </div>

            <div
              data-testid="topology-tab-ue-count-effective-value"
              style={{
                display: 'grid',
                gap: 6,
                color: UI_TOKENS.color.text.secondary,
                fontSize: UI_TOKENS.type.size.body,
                lineHeight: 1.45,
              }}
            >
              <span>
                Effective UE count: {effectiveUeCount} ({hasUeCountOverride ? 'override' : 'default'})
              </span>
            </div>

            <div style={{
              padding: '10px 12px',
              borderRadius: UI_TOKENS.radius.md,
              background: 'rgba(255, 214, 125, 0.10)',
              border: '1px solid rgba(255, 214, 125, 0.24)',
              color: 'rgba(255, 231, 180, 0.9)',
              fontSize: UI_TOKENS.type.size.body,
              lineHeight: 1.4,
            }}>
              Adjusting UE count restarts the simulation.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                data-testid="topology-tab-ue-count-reset"
                className={UI_CLASSES.button}
                type="button"
                onClick={() => onTopologyChange({ ...topology, ueCount: null })}
                style={{
                  cursor: 'pointer',
                  borderRadius: UI_TOKENS.radius.md,
                  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                  background: 'rgba(132, 148, 163, 0.08)',
                  color: UI_TOKENS.color.text.secondary,
                  padding: '8px 10px',
                  fontSize: UI_TOKENS.type.size.body,
                  fontWeight: UI_TOKENS.type.weight.strong,
                }}
              >
                Reset UE count
              </button>
            </div>
          </section>

          <div style={dividerStyle} />

          <section
            style={{
              display: 'grid',
              gap: 12,
              padding: '14px 15px',
              borderRadius: UI_TOKENS.radius.lg,
              background: UI_TOKENS.color.surface.card,
              border: `1px solid ${UI_TOKENS.color.border.subtle}`,
              borderLeft: `4px solid ${UI_TOKENS.color.semantic.fixed}aa`,
            }}
          >
            <div style={{
              display: 'grid',
              gap: 5,
              minWidth: 0,
            }}>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  color: UI_TOKENS.color.text.controlLabel,
                  fontSize: UI_TOKENS.type.size.bodyLg,
                  fontWeight: UI_TOKENS.type.weight.heavy,
                  lineHeight: 1.3,
                }}>
                  UE distribution mode
                </span>
                {!hasUeDistributionOverride && (
                  <span style={{
                    padding: '3px 7px',
                    borderRadius: UI_TOKENS.radius.sm,
                    background: 'rgba(132, 148, 163, 0.12)',
                    border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                    color: UI_TOKENS.color.text.secondary,
                    fontSize: UI_TOKENS.type.size.caption,
                    fontWeight: UI_TOKENS.type.weight.heavy,
                    textTransform: 'uppercase',
                  }}>
                    Default random
                  </span>
                )}
              </div>
              <p style={{ ...explanatoryTextStyle, margin: 0 }}>
                Simulation Setting for secondary UE placement. Primary UE remains fixed.
              </p>
            </div>

            <fieldset
              data-testid="topology-tab-ue-distribution-radio"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 8,
                padding: 0,
                margin: 0,
                border: 0,
                minWidth: 0,
              }}
            >
              <legend style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}>
                UE distribution mode
              </legend>
              {UE_DISTRIBUTION_MODE_OPTIONS.map(option => {
                const active = effectiveUeDistributionMode === option;
                return (
                  <label
                    key={option}
                    style={{
                      cursor: 'pointer',
                      display: 'grid',
                      gap: 5,
                      justifyItems: 'center',
                      padding: '10px 9px',
                      borderRadius: UI_TOKENS.radius.md,
                      border: `1px solid ${active ? `${UI_TOKENS.color.semantic.fixed}66` : UI_TOKENS.color.border.subtle}`,
                      background: active ? 'rgba(255, 214, 125, 0.12)' : 'rgba(255, 255, 255, 0.045)',
                      color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                      fontSize: UI_TOKENS.type.size.body,
                      fontWeight: UI_TOKENS.type.weight.strong,
                      lineHeight: 1.25,
                      textTransform: 'capitalize',
                    }}
                  >
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
                      style={{
                        width: 16,
                        height: 16,
                        margin: 0,
                        accentColor: UI_TOKENS.color.semantic.fixed,
                        cursor: 'pointer',
                      }}
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </fieldset>

            <div style={{
              padding: '10px 12px',
              borderRadius: UI_TOKENS.radius.md,
              background: 'rgba(255, 214, 125, 0.10)',
              border: '1px solid rgba(255, 214, 125, 0.24)',
              color: 'rgba(255, 231, 180, 0.9)',
              fontSize: UI_TOKENS.type.size.body,
              lineHeight: 1.4,
            }}>
              Changing UE distribution restarts the simulation.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                data-testid="topology-tab-ue-distribution-reset"
                className={UI_CLASSES.button}
                type="button"
                onClick={() => onTopologyChange({ ...topology, ueDistributionMode: null })}
                style={{
                  cursor: 'pointer',
                  borderRadius: UI_TOKENS.radius.md,
                  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                  background: 'rgba(132, 148, 163, 0.08)',
                  color: UI_TOKENS.color.text.secondary,
                  padding: '8px 10px',
                  fontSize: UI_TOKENS.type.size.body,
                  fontWeight: UI_TOKENS.type.weight.strong,
                }}
              >
                Reset distribution
              </button>
            </div>
          </section>

          <div style={dividerStyle} />

          <section
            style={{
              display: 'grid',
              gap: 12,
              padding: '14px 15px',
              borderRadius: UI_TOKENS.radius.lg,
              background: UI_TOKENS.color.surface.card,
              border: `1px solid ${UI_TOKENS.color.border.subtle}`,
              borderLeft: `4px solid ${UI_TOKENS.color.semantic.fixed}aa`,
            }}
          >
            <div style={{
              display: 'grid',
              gap: 5,
              minWidth: 0,
            }}>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  color: UI_TOKENS.color.text.controlLabel,
                  fontSize: UI_TOKENS.type.size.bodyLg,
                  fontWeight: UI_TOKENS.type.weight.heavy,
                  lineHeight: 1.3,
                }}>
                  UE mobility
                </span>
                {!hasUeMobilityOverride && (
                  <span style={{
                    padding: '3px 7px',
                    borderRadius: UI_TOKENS.radius.sm,
                    background: 'rgba(132, 148, 163, 0.12)',
                    border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                    color: UI_TOKENS.color.text.secondary,
                    fontSize: UI_TOKENS.type.size.caption,
                    fontWeight: UI_TOKENS.type.weight.heavy,
                    textTransform: 'uppercase',
                  }}>
                    Default static
                  </span>
                )}
              </div>
              <p style={{ ...explanatoryTextStyle, margin: 0 }}>
                Simulation Setting for secondary UE motion. Primary UE remains fixed.
              </p>
            </div>

            <fieldset
              data-testid="topology-tab-ue-mobility-radio"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 8,
                padding: 0,
                margin: 0,
                border: 0,
                minWidth: 0,
              }}
            >
              <legend style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}>
                UE mobility
              </legend>
              {UE_MOBILITY_MODE_OPTIONS.map(option => {
                const active = effectiveUeMobilityMode === option;
                return (
                  <label
                    key={option}
                    style={{
                      cursor: 'pointer',
                      display: 'grid',
                      gap: 5,
                      justifyItems: 'center',
                      padding: '10px 9px',
                      borderRadius: UI_TOKENS.radius.md,
                      border: `1px solid ${active ? `${UI_TOKENS.color.semantic.fixed}66` : UI_TOKENS.color.border.subtle}`,
                      background: active ? 'rgba(255, 214, 125, 0.12)' : 'rgba(255, 255, 255, 0.045)',
                      color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                      fontSize: UI_TOKENS.type.size.body,
                      fontWeight: UI_TOKENS.type.weight.strong,
                      lineHeight: 1.25,
                    }}
                  >
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
                      style={{
                        width: 16,
                        height: 16,
                        margin: 0,
                        accentColor: UI_TOKENS.color.semantic.fixed,
                        cursor: 'pointer',
                      }}
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </fieldset>

            {showUeMobilityParams && (
              <div style={{
                display: 'grid',
                gap: 12,
                padding: '12px 13px',
                borderRadius: UI_TOKENS.radius.md,
                background: 'rgba(255, 255, 255, 0.045)',
                border: `1px solid ${UI_TOKENS.color.border.subtle}`,
              }}>
                <label style={{ display: 'grid', gap: 7 }}>
                  <span style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    color: UI_TOKENS.color.text.controlLabel,
                    fontSize: UI_TOKENS.type.size.body,
                    fontWeight: UI_TOKENS.type.weight.strong,
                    lineHeight: 1.35,
                  }}>
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
                    style={{
                      width: '100%',
                      accentColor: UI_TOKENS.color.semantic.fixed,
                      cursor: 'pointer',
                    }}
                  />
                </label>

                {effectiveUeMobilityMode === 'waypoints' && (
                  <label style={{ display: 'grid', gap: 7 }}>
                    <span style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      color: UI_TOKENS.color.text.controlLabel,
                      fontSize: UI_TOKENS.type.size.body,
                      fontWeight: UI_TOKENS.type.weight.strong,
                      lineHeight: 1.35,
                    }}>
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
                      style={{
                        width: '100%',
                        accentColor: UI_TOKENS.color.semantic.fixed,
                        cursor: 'pointer',
                      }}
                    />
                  </label>
                )}

                {effectiveUeMobilityMode === 'manhattan' && (
                  <label style={{ display: 'grid', gap: 7 }}>
                    <span style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      color: UI_TOKENS.color.text.controlLabel,
                      fontSize: UI_TOKENS.type.size.body,
                      fontWeight: UI_TOKENS.type.weight.strong,
                      lineHeight: 1.35,
                    }}>
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
                      style={{
                        width: '100%',
                        accentColor: UI_TOKENS.color.semantic.fixed,
                        cursor: 'pointer',
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            <div style={{
              padding: '10px 12px',
              borderRadius: UI_TOKENS.radius.md,
              background: 'rgba(255, 214, 125, 0.10)',
              border: '1px solid rgba(255, 214, 125, 0.24)',
              color: 'rgba(255, 231, 180, 0.9)',
              fontSize: UI_TOKENS.type.size.body,
              lineHeight: 1.4,
            }}>
              Changing UE mobility restarts the simulation.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                data-testid="topology-tab-ue-mobility-reset"
                className={UI_CLASSES.button}
                type="button"
                onClick={() => onTopologyChange({ ...topology, ueMobilityMode: null, ueMobilityParams: null })}
                style={{
                  cursor: 'pointer',
                  borderRadius: UI_TOKENS.radius.md,
                  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                  background: 'rgba(132, 148, 163, 0.08)',
                  color: UI_TOKENS.color.text.secondary,
                  padding: '8px 10px',
                  fontSize: UI_TOKENS.type.size.body,
                  fontWeight: UI_TOKENS.type.weight.strong,
                }}
              >
                Reset mobility
              </button>
            </div>

            <label
              data-testid="topology-tab-ue-trails-label"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: UI_TOKENS.radius.md,
                background: enableUeTrails ? 'rgba(255, 214, 125, 0.10)' : 'rgba(255, 255, 255, 0.045)',
                border: `1px solid ${enableUeTrails ? `${UI_TOKENS.color.semantic.fixed}55` : UI_TOKENS.color.border.subtle}`,
                color: enableUeTrails ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                fontSize: UI_TOKENS.type.size.body,
                fontWeight: UI_TOKENS.type.weight.strong,
                lineHeight: 1.35,
                cursor: 'pointer',
              }}
            >
              <input
                data-testid="topology-tab-ue-trails-toggle"
                type="checkbox"
                checked={enableUeTrails}
                onChange={event => onTopologyChange({
                  ...topology,
                  enableUeTrails: event.target.checked ? true : null,
                })}
                style={{
                  width: 16,
                  height: 16,
                  margin: 0,
                  accentColor: UI_TOKENS.color.semantic.fixed,
                  cursor: 'pointer',
                }}
              />
              <span>Show UE trails</span>
            </label>
          </section>
        </>
      )}
    </div>
  );
}
