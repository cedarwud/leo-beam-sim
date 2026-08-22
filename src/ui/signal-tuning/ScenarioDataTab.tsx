import { useState } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import {
  DEFAULT_BEAM_LAYOUT_COUNT,
  SUPPORTED_BEAM_LAYOUT_COUNTS,
  type SupportedBeamLayoutCount,
} from '../../core/beam/completeHexPresets';
import { SINR_LIVE_CELL_COUNT } from '../../scene/sinrLiveCellRuntime';
import { useLocale } from '../../i18n';
import { SIMULATOR_CONSTELLATIONS, SIMULATOR_TIME_ZONE, type SimulatorConstellation } from '../../simulator/types';
import { txBi } from './labels';
import { captionTextStyle, groupTitleStyle, pagePanelStyle, srOnlyStyle } from './styles';

const INITIAL_SCENARIO_DATE = '2026-08-12';
const INITIAL_SCENARIO_TIME = '20:00';
const SCENARIO_HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const SCENARIO_MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const BEAM_LAYOUT_OPTIONS = SUPPORTED_BEAM_LAYOUT_COUNTS;

/** One default target plus exactly one entry for every live scene cell. */
function focusCellOptions(cellCount: number): readonly (number | null)[] {
  return [null, ...Array.from({ length: Math.max(0, cellCount) }, (_, index) => index)];
}

export type BeamLayoutCount = SupportedBeamLayoutCount;

export interface ScenarioDataTabProps {
  readonly constellation?: SimulatorConstellation;
  readonly onConstellationChange?: (next: SimulatorConstellation) => void;
  /** Optional controlled scene value. Without it the isolated tab keeps its local preview state. */
  readonly beamLayoutCount?: BeamLayoutCount;
  readonly onBeamLayoutCountChange?: (next: BeamLayoutCount) => void;
  /** Optional controlled serving-satellite override for the canonical frame surface. */
  readonly servingBeamLayoutCount?: BeamLayoutCount;
  readonly onServingBeamLayoutCountChange?: (next: BeamLayoutCount) => void;
  /** Optional controlled candidate-satellite override for the canonical frame surface. */
  readonly candidateBeamLayoutCount?: BeamLayoutCount;
  readonly onCandidateBeamLayoutCountChange?: (next: BeamLayoutCount) => void;
  /** Clears the candidate override so it follows the serving-satellite setting. */
  readonly onCandidateBeamLayoutReset?: () => void;
  /** Which scene cell's UE the left formula panel and right readout follow. */
  readonly focusCellId?: number | null;
  readonly onFocusCellChange?: (next: number | null) => void;
  /** How many earth-fixed truth cells the scene serves; sizes the focus grid. */
  readonly focusCellCount?: number;
  /** Identifies which existing scene/frame owner receives the beam-layout edits. */
  readonly connection?: 'display-only' | 'canonical-analysis' | 'live-scene';
}

const fieldStyle = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box' as const,
  padding: '9px 10px',
  borderRadius: UI_TOKENS.radius.md,
  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
  background: UI_TOKENS.color.surface.card,
  color: UI_TOKENS.color.text.primary,
  colorScheme: 'dark' as const,
  fontSize: UI_TOKENS.type.size.body,
};

const timeSelectStyle = {
  ...fieldStyle,
  background: '#10232f',
  backgroundColor: '#10232f',
  color: UI_TOKENS.color.text.primary,
  colorScheme: 'dark' as const,
};

const timeOptionStyle = {
  backgroundColor: '#10232f',
  color: UI_TOKENS.color.text.primary,
};

export function ScenarioDataTab({
  constellation: controlledConstellation,
  onConstellationChange,
  beamLayoutCount: controlledBeamLayoutCount,
  onBeamLayoutCountChange,
  servingBeamLayoutCount: controlledServingBeamLayoutCount,
  onServingBeamLayoutCountChange,
  candidateBeamLayoutCount: controlledCandidateBeamLayoutCount,
  onCandidateBeamLayoutCountChange,
  onCandidateBeamLayoutReset,
  focusCellId = null,
  onFocusCellChange,
  focusCellCount = SINR_LIVE_CELL_COUNT,
  connection = 'display-only',
}: ScenarioDataTabProps = {}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const [localConstellation, setLocalConstellation] = useState<SimulatorConstellation>('starlink');
  const [scenarioDate, setScenarioDate] = useState(INITIAL_SCENARIO_DATE);
  const [scenarioTime, setScenarioTime] = useState(INITIAL_SCENARIO_TIME);
  const [localBeamLayoutCount, setLocalBeamLayoutCount] = useState<BeamLayoutCount>(DEFAULT_BEAM_LAYOUT_COUNT);
  const [localServingBeamLayoutCount, setLocalServingBeamLayoutCount] = useState<BeamLayoutCount>(DEFAULT_BEAM_LAYOUT_COUNT);
  const [localCandidateBeamLayoutCount, setLocalCandidateBeamLayoutCount] = useState<BeamLayoutCount>(DEFAULT_BEAM_LAYOUT_COUNT);
  const beamLayoutCount = controlledBeamLayoutCount ?? localBeamLayoutCount;
  const servingBeamLayoutCount = controlledServingBeamLayoutCount ?? localServingBeamLayoutCount;
  const candidateBeamLayoutCount = controlledCandidateBeamLayoutCount
    ?? controlledServingBeamLayoutCount
    ?? localCandidateBeamLayoutCount;
  const constellation = controlledConstellation ?? localConstellation;
  const setConstellation = onConstellationChange ?? setLocalConstellation;
  const setBeamLayoutCount = onBeamLayoutCountChange ?? setLocalBeamLayoutCount;
  const setServingBeamLayoutCount = onServingBeamLayoutCountChange ?? setLocalServingBeamLayoutCount;
  const setCandidateBeamLayoutCount = onCandidateBeamLayoutCountChange ?? setLocalCandidateBeamLayoutCount;
  const [scenarioHour = '20', scenarioMinute = '00'] = scenarioTime.split(':');
  const constellationName = SIMULATOR_CONSTELLATIONS.find(option => option.id === constellation)?.label ?? constellation;
  const roleBeamConfigurations = [
    {
      key: 'serving',
      title: say('scenarioData.servingSatellite', '服務衛星', 'Serving satellite'),
      value: servingBeamLayoutCount,
      onChange: setServingBeamLayoutCount,
    },
    {
      key: 'candidate',
      title: say('scenarioData.candidateSatellite', '候選衛星', 'Candidate satellite'),
      value: candidateBeamLayoutCount,
      onChange: setCandidateBeamLayoutCount,
      onReset: onCandidateBeamLayoutReset,
    },
  ] satisfies ReadonlyArray<{
    key: 'serving' | 'candidate';
    title: string;
    value: BeamLayoutCount;
    onChange: (value: BeamLayoutCount) => void;
    onReset?: () => void;
  }>;

  return (
    <section
      id="tuning-page-panel-scenario-data"
      data-testid="scenario-data-page"
      data-scenario-connection={connection}
      role="tabpanel"
      aria-label={say('tab.scenario.label', '場景資料', 'Scenario data')}
      style={{ ...pagePanelStyle, gap: 14 }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ ...groupTitleStyle, color: UI_TOKENS.color.semantic.info }}>
          {say('scenarioData.title', '場景資料', 'Scenario data')}
        </div>
        <div style={captionTextStyle}>
          {say(
            'scenarioData.description',
            '設定星座配置與展示日期時間；時間採 24 小時制，最小單位為分鐘。',
            'Set the constellation configuration and display date/time. Time uses a 24-hour clock with minute precision.',
          )}
        </div>
      </div>

      <fieldset
        data-testid="scenario-data-constellation-control"
        style={{
          display: 'grid',
          gap: 8,
          margin: 0,
          padding: 0,
          border: 0,
        }}
      >
        <legend style={captionTextStyle}>
          {say('scenarioData.constellation', '衛星星座', 'Constellation')}
        </legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {SIMULATOR_CONSTELLATIONS.map(option => {
            const selected = option.id === constellation;
            return (
              <label
                key={option.id}
                htmlFor={`scenario-data-constellation-${option.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  minHeight: 40,
                  padding: '7px 9px',
                  borderRadius: UI_TOKENS.radius.md,
                  border: selected
                    ? `1px solid ${UI_TOKENS.color.semantic.info}`
                    : `1px solid ${UI_TOKENS.color.border.subtle}`,
                  background: selected ? 'rgba(142, 186, 255, 0.12)' : UI_TOKENS.color.surface.card,
                  color: selected ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                  cursor: 'pointer',
                  fontWeight: UI_TOKENS.type.weight.strong,
                }}
              >
                <input
                  id={`scenario-data-constellation-${option.id}`}
                  type="radio"
                  name="scenario-data-constellation"
                  value={option.id}
                  checked={selected}
                  onChange={() => setConstellation(option.id)}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div
        data-testid="scenario-data-time-controls"
        style={{
          display: 'grid',
          gap: 8,
          padding: 12,
          borderRadius: UI_TOKENS.radius.lg,
          background: UI_TOKENS.color.surface.cardFaint,
          border: `1px solid ${UI_TOKENS.color.border.subtle}`,
        }}
      >
        <div style={groupTitleStyle}>
          {say('scenarioData.time.title', '展示日期與時間', 'Display date and time')}
        </div>
        <label htmlFor="scenario-data-date" style={captionTextStyle}>
          {say('scenarioData.date', '日期', 'Date')}
        </label>
        <input
          id="scenario-data-date"
          data-testid="scenario-data-date"
          type="date"
          value={scenarioDate}
          onChange={event => setScenarioDate(event.currentTarget.value)}
          style={fieldStyle}
        />
        <div id="scenario-data-time-label" style={captionTextStyle}>
          {say('scenarioData.time', '時間（24 小時制）', 'Time (24-hour)')}
        </div>
        <div
          id="scenario-data-time"
          data-testid="scenario-data-time"
          role="group"
          aria-labelledby="scenario-data-time-label"
          aria-describedby="scenario-data-time-format"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', gap: 8, alignItems: 'center' }}
        >
          <select
            className="leo-scenario-time-select"
            id="scenario-data-hour"
            data-testid="scenario-data-hour"
            aria-label={say('scenarioData.hour', '小時（24 小時制）', 'Hour (24-hour)')}
            value={scenarioHour}
            onChange={event => setScenarioTime(`${event.currentTarget.value}:${scenarioMinute}`)}
            style={timeSelectStyle}
          >
            {SCENARIO_HOURS.map(hour => <option key={hour} value={hour} style={timeOptionStyle}>{hour}</option>)}
          </select>
          <span aria-hidden="true" style={{ ...groupTitleStyle, color: UI_TOKENS.color.text.secondary }}>:</span>
          <select
            className="leo-scenario-time-select"
            id="scenario-data-minute"
            data-testid="scenario-data-minute"
            aria-label={say('scenarioData.minute', '分鐘', 'Minute')}
            value={scenarioMinute}
            onChange={event => setScenarioTime(`${scenarioHour}:${event.currentTarget.value}`)}
            style={timeSelectStyle}
          >
            {SCENARIO_MINUTES.map(minute => <option key={minute} value={minute} style={timeOptionStyle}>{minute}</option>)}
          </select>
        </div>
        <div id="scenario-data-time-format" data-testid="scenario-data-time-format" style={captionTextStyle}>
          {say('scenarioData.time.format', '格式 HH:MM（00:00–23:59）', 'Format HH:MM (00:00–23:59)')}
        </div>
        <div style={{ ...captionTextStyle, color: UI_TOKENS.color.text.secondary }}>
          {say('scenarioData.timezone', '時區', 'Time zone')}: {SIMULATOR_TIME_ZONE}
        </div>
      </div>

      <fieldset
        data-testid="scenario-data-beam-configuration-control"
        style={{
          display: 'grid',
          gap: 9,
          margin: 0,
          padding: 12,
          borderRadius: UI_TOKENS.radius.lg,
          border: `1px solid ${UI_TOKENS.color.border.subtle}`,
          background: UI_TOKENS.color.surface.cardFaint,
        }}
      >
        <legend style={{ ...groupTitleStyle, padding: '0 4px' }}>
          {say('scenarioData.configuration', '場景配置', 'Scene configuration')}
        </legend>
        {connection !== 'live-scene' && (
          <>
            <div style={captionTextStyle}>
              {say('scenarioData.beamLayout', '每顆衛星波束配置', 'Beams per satellite')}
            </div>
            <div role="radiogroup" aria-label={say('scenarioData.beamLayout', '每顆衛星波束配置', 'Beams per satellite')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {BEAM_LAYOUT_OPTIONS.map(option => {
                const selected = option === beamLayoutCount;
                return (
                  <label
                    key={option}
                    htmlFor={`scenario-data-beam-layout-${option}`}
                    style={{
                      display: 'grid',
                      justifyItems: 'center',
                      gap: 3,
                      minHeight: 48,
                      padding: '7px 8px',
                      borderRadius: UI_TOKENS.radius.md,
                      border: selected
                        ? `1px solid ${UI_TOKENS.color.semantic.info}`
                        : `1px solid ${UI_TOKENS.color.border.subtle}`,
                      background: selected ? 'rgba(142, 186, 255, 0.12)' : UI_TOKENS.color.surface.card,
                      color: selected ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                      cursor: 'pointer',
                      fontWeight: UI_TOKENS.type.weight.strong,
                    }}
                  >
                    <input
                      id={`scenario-data-beam-layout-${option}`}
                      type="radio"
                      name="scenario-data-beam-layout"
                      value={option}
                      checked={selected}
                      onChange={() => setBeamLayoutCount(option)}
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
        <div style={{ display: 'grid', gap: 8, marginTop: 3 }}>
          {roleBeamConfigurations.map(configuration => (
            <div
              key={configuration.key}
              data-testid={`scenario-data-${configuration.key}-beam-configuration`}
              style={{
                display: 'grid',
                gap: 6,
                padding: '8px 9px',
                borderRadius: UI_TOKENS.radius.md,
                border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                background: UI_TOKENS.color.surface.card,
              }}
            >
              <div style={{ ...captionTextStyle, color: UI_TOKENS.color.text.primary, fontWeight: UI_TOKENS.type.weight.strong }}>
                {configuration.title}
              </div>
              <div role="radiogroup" aria-label={`${configuration.title} ${say('scenarioData.beamLayout', '波束配置', 'beam configuration')}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                {BEAM_LAYOUT_OPTIONS.map(option => {
                  const selected = option === configuration.value;
                  return (
                    <label
                      key={option}
                      htmlFor={`scenario-data-${configuration.key}-beam-layout-${option}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        minHeight: 36,
                        borderRadius: UI_TOKENS.radius.md,
                        border: selected
                          ? `1px solid ${UI_TOKENS.color.semantic.info}`
                          : `1px solid ${UI_TOKENS.color.border.subtle}`,
                        background: selected ? 'rgba(142, 186, 255, 0.12)' : UI_TOKENS.color.surface.cardFaint,
                        color: selected ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                        cursor: 'pointer',
                        fontWeight: UI_TOKENS.type.weight.strong,
                      }}
                    >
                      <input
                        id={`scenario-data-${configuration.key}-beam-layout-${option}`}
                        type="radio"
                        name={`scenario-data-${configuration.key}-beam-layout`}
                        value={option}
                        checked={selected}
                        onChange={() => configuration.onChange(option)}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
              {configuration.key === 'candidate' && configuration.onReset !== undefined && (
                <button
                  type="button"
                  data-testid="scenario-data-candidate-follow-serving"
                  onClick={configuration.onReset}
                  style={{
                    justifySelf: 'start',
                    minHeight: 30,
                    padding: '5px 8px',
                    borderRadius: UI_TOKENS.radius.md,
                    border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                    background: UI_TOKENS.color.surface.cardFaint,
                    color: UI_TOKENS.color.text.secondary,
                    cursor: 'pointer',
                    fontSize: UI_TOKENS.type.size.caption,
                  }}
                >
                  {say('scenarioData.candidate.followServing', '候選跟隨服務', 'Follow serving')}
                </button>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      {onFocusCellChange !== undefined && (
        <fieldset
          data-testid="scenario-data-focus-cell-control"
          style={{
            display: 'grid',
            gap: 9,
            margin: 0,
            padding: 12,
            borderRadius: UI_TOKENS.radius.lg,
            border: `1px solid ${UI_TOKENS.color.border.subtle}`,
            background: UI_TOKENS.color.surface.cardFaint,
          }}
        >
          <legend style={{ ...groupTitleStyle, padding: '0 4px' }}>
            {say('scenarioData.sceneCells', '場景 cells', 'Scene cells')}
          </legend>
          <div
            role="radiogroup"
            aria-label={say('scenarioData.sceneCells', '場景 cells', 'Scene cells')}
            style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(8, focusCellCount + 1)}, minmax(0, 1fr))`, gap: 4 }}
          >
            {focusCellOptions(focusCellCount).map(option => {
              const selected = option === focusCellId;
              return (
                <label
                  key={option ?? 'default'}
                  htmlFor={`scenario-data-focus-cell-${option ?? 'default'}`}
                  title={option === null
                    ? say('scenarioData.focusCell.default', '預設使用者', 'Default UE')
                    : `cell ${option}`}
                  style={{
                    display: 'grid',
                    justifyItems: 'center',
                    alignContent: 'center',
                    minHeight: 34,
                    borderRadius: UI_TOKENS.radius.md,
                    border: selected
                      ? `1px solid ${UI_TOKENS.color.semantic.info}`
                      : `1px solid ${UI_TOKENS.color.border.subtle}`,
                    background: selected ? 'rgba(142, 186, 255, 0.16)' : UI_TOKENS.color.surface.card,
                    color: selected ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                    cursor: 'pointer',
                    fontSize: UI_TOKENS.type.size.caption,
                    fontWeight: UI_TOKENS.type.weight.strong,
                  }}
                >
                  <input
                    id={`scenario-data-focus-cell-${option ?? 'default'}`}
                    type="radio"
                    name="scenario-data-focus-cell"
                    value={option ?? 'default'}
                    checked={selected}
                    style={srOnlyStyle}
                    onChange={() => onFocusCellChange(option)}
                  />
                  <span>{option === null ? '\u2014' : option}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div
        data-testid="scenario-data-summary"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: UI_TOKENS.radius.md,
          border: `1px solid ${UI_TOKENS.color.semantic.info}44`,
          background: `${UI_TOKENS.color.semantic.info}0d`,
        }}
      >
        <span style={captionTextStyle}>{say('scenarioData.selected', '目前選擇', 'Selected')}</span>
        <strong style={{ color: UI_TOKENS.color.text.primary, fontSize: UI_TOKENS.type.size.body }}>
          {constellationName} · {scenarioDate} {scenarioTime}
        </strong>
      </div>
    </section>
  );
}
