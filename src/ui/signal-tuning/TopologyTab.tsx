import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import type { Profile } from '../../profiles/types';
import type { SceneTopologyState } from '../../sceneTopology';
import { controlStackStyle, dividerStyle, explanatoryTextStyle } from './styles';

interface TopologyTabProps {
  topology: SceneTopologyState;
  baseProfile: Profile;
  onTopologyChange: (next: SceneTopologyState) => void;
  onReset: () => void;
}

function formatSatCount(value: number): string {
  return `${value.toFixed(0)} sats`;
}

const BEAM_COUNT_OPTIONS = [7, 19, 37] as const;

type BeamCountOption = typeof BEAM_COUNT_OPTIONS[number];

const BEAM_COUNT_OPTION_TESTIDS: Record<BeamCountOption, string> = {
  7: 'topology-tab-beam-count-option-7',
  19: 'topology-tab-beam-count-option-19',
  37: 'topology-tab-beam-count-option-37',
};

function formatBeamCount(value: number): string {
  return `${value.toFixed(0)} beams`;
}

function isBeamCountOption(value: number): value is BeamCountOption {
  return BEAM_COUNT_OPTIONS.includes(value as BeamCountOption);
}

export function TopologyTab({
  topology,
  baseProfile,
  onTopologyChange,
  onReset,
}: TopologyTabProps) {
  const baseSatCount = baseProfile.orbit.shells[0]?.satsPerPlane ?? 4;
  const effectiveSatCount = topology.satsPerPlane ?? baseSatCount;
  const hasSatOverride = topology.satsPerPlane !== null;
  const unchangedShellCount = Math.max(baseProfile.orbit.shells.length - 1, 0);
  const baseBeamCount = baseProfile.beams.perSatellite;
  const effectiveBeamCount = topology.beamCountPerSatellite ?? baseBeamCount;
  const hasBeamOverride = topology.beamCountPerSatellite !== null;
  const activeBeamCount = hasBeamOverride
    ? topology.beamCountPerSatellite
    : isBeamCountOption(baseBeamCount)
      ? baseBeamCount
      : null;

  return (
    <div style={controlStackStyle}>
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
    </div>
  );
}
