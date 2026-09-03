import { UI_TOKENS } from '../../constants/uiTokens';
import {
  DEFAULT_BEAM_LAYOUT_COUNT,
  type SupportedBeamLayoutCount,
} from '../../core/beam/completeHexPresets';
import { useLocale } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorParameters } from '../../simulator/types';
import { CanonicalEeTab } from './CanonicalEeTab';
import { CanonicalSinrTab } from './CanonicalSinrTab';
import { MainTabList } from './MainTabList';
import { PowerTab } from './PowerTab';
import { ScenarioDataTab } from './ScenarioDataTab';
import { ThroughputTab } from './ThroughputTab';
import { TleScenarioDisclosure } from './TleScenarioDisclosure';
import { txBi } from './labels';
import { panelStyle } from './styles';
import type { MainTabKey } from './types';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

const PARAMETER_KEYS = Object.keys(DEFAULT_SIMULATOR_PARAMETERS) as Array<keyof SimulatorParameters>;

function ModelParameterReset({ analysis }: { readonly analysis: HomepageCanonicalAnalysisState }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const usesDefaults = PARAMETER_KEYS.every(
    key => analysis.parameters[key] === DEFAULT_SIMULATOR_PARAMETERS[key],
  );

  return (
    <div
      data-testid="homepage-model-parameter-reset"
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
    >
      <button
        type="button"
        data-testid="homepage-model-parameter-reset-button"
        disabled={usesDefaults}
        onClick={analysis.resetParameters}
        style={{
          minHeight: 34,
          padding: '6px 9px',
          borderRadius: UI_TOKENS.radius.md,
          border: `1px solid ${UI_TOKENS.color.border.soft}`,
          background: usesDefaults ? UI_TOKENS.color.surface.cardFaint : UI_TOKENS.color.surface.card,
          color: usesDefaults ? UI_TOKENS.color.text.faint : UI_TOKENS.color.semantic.tuning,
          cursor: usesDefaults ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {say('homepage.parameters.reset.action', '回復預設', 'Reset')}
      </button>
    </div>
  );
}

export function HomepageCanonicalControls({
  analysis,
  activeTab,
  onActiveTabChange,
}: {
  readonly analysis: HomepageCanonicalAnalysisState;
  readonly activeTab: MainTabKey;
  readonly onActiveTabChange: (next: MainTabKey) => void;
}) {
  // The archived scene adapter consumes the fixed seven-cell/seven-beam schema.
  // Keep the canonical controls honest instead of exposing frame options that
  // would be accepted by the analysis worker but rejected by the scene.
  const globalBeamLayoutCount: SupportedBeamLayoutCount = DEFAULT_BEAM_LAYOUT_COUNT;
  const servingSatelliteId = analysis.frame?.selectedSatelliteId ?? null;
  const candidateSatelliteId = analysis.frame?.candidateLink?.satelliteId ?? null;
  const beamLayoutOverrides = analysis.frameOptions.perSatelliteBeamLayoutCount ?? {};
  const resolveRoleBeamLayoutCount = (satelliteId: string | null): SupportedBeamLayoutCount => {
    const override = satelliteId === null ? undefined : beamLayoutOverrides[satelliteId];
    return override === DEFAULT_BEAM_LAYOUT_COUNT ? override : globalBeamLayoutCount;
  };
  const updateBeamLayoutCount = (next: SupportedBeamLayoutCount) => {
    analysis.setFrameOptions({
      ...analysis.frameOptions,
      beamLayoutCount: next,
    });
  };
  const updateRoleBeamLayoutCount = (satelliteId: string | null, next: SupportedBeamLayoutCount) => {
    if (satelliteId === null) return;
    analysis.setFrameOptions({
      ...analysis.frameOptions,
      perSatelliteBeamLayoutCount: {
        ...beamLayoutOverrides,
        [satelliteId]: next,
      },
    });
  };

  return (
    <aside
      className="leo-signal-tuning-panel"
      data-testid="homepage-canonical-controls"
      aria-label="Analysis parameters"
      style={panelStyle}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <MainTabList activeTab={activeTab} onChange={onActiveTabChange} />
        <ModelParameterReset analysis={analysis} />

        {activeTab === 'scenario' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <TleScenarioDisclosure analysis={analysis} />
            <ScenarioDataTab
              connection="canonical-analysis"
              beamLayoutCount={globalBeamLayoutCount}
              beamLayoutOptions={[DEFAULT_BEAM_LAYOUT_COUNT]}
              onBeamLayoutCountChange={updateBeamLayoutCount}
              servingBeamLayoutCount={resolveRoleBeamLayoutCount(servingSatelliteId)}
              onServingBeamLayoutCountChange={next => updateRoleBeamLayoutCount(servingSatelliteId, next)}
              candidateBeamLayoutCount={resolveRoleBeamLayoutCount(candidateSatelliteId)}
              onCandidateBeamLayoutCountChange={next => updateRoleBeamLayoutCount(candidateSatelliteId, next)}
            />
          </div>
        )}

        {activeTab === 'sinr' && (
          <CanonicalSinrTab analysis={analysis} />
        )}

        {activeTab === 'energy' && (
          <CanonicalEeTab analysis={analysis} />
        )}

        {activeTab === 'power' && (
          <PowerTab parameters={analysis.parameters} onParametersChange={analysis.setParameters} />
        )}

        {activeTab === 'throughput' && (
          <ThroughputTab parameters={analysis.parameters} analysis={analysis} />
        )}
      </div>
    </aside>
  );
}
