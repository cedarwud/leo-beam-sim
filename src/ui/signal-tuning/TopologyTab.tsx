import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import type { Profile } from '../../profiles/types';
import type { SceneTopologyState } from '../../sceneTopology';
import { controlStackStyle, explanatoryTextStyle } from './styles';

interface TopologyTabProps {
  topology: SceneTopologyState;
  baseProfile: Profile;
  onTopologyChange: (next: SceneTopologyState) => void;
  onReset: () => void;
}

function formatSatCount(value: number): string {
  return `${value.toFixed(0)} sats`;
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
    </div>
  );
}
