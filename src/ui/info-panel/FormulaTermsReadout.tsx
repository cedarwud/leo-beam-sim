import { UI_TOKENS } from '../../constants/uiTokens';
import type { AngleAwareFormulaFrame } from '../../engine/signal/types';
import type { SimState } from '../../scene/types';
import {
  formatCellServingIdentity,
  formatPanelBeamIdentity,
  formatSinr,
  sinrColor,
} from './formatters';
import { usePanelCopy } from './panelHelp';
import { AngleAwareValueRows } from '../signal-tuning/AngleAwareValueRows';
import {
  LinkAngle,
  LinkChannel,
  LinkInterference,
  LinkRfPower,
  LinkSinr,
  LinkTransmitGain,
} from '../signal-tuning/FormulaSymbols';

type FormulaEvidenceStatus = 'current' | 'stale' | 'waiting';

function formulaStatus(
  frame: AngleAwareFormulaFrame | null | undefined,
  stale: boolean,
): FormulaEvidenceStatus {
  if (stale) return 'stale';
  return frame ? 'current' : 'waiting';
}

function statusCopy(
  status: FormulaEvidenceStatus,
  tx: (key: string) => string,
): string {
  switch (status) {
    case 'current':
      return tx('panel.formulaTerms.status.live');
    case 'stale':
      return tx('panel.formulaTerms.status.stale');
    case 'waiting':
      return tx('panel.formulaTerms.status.waiting');
  }
}

function FormulaIdentity({
  source,
  servingCellId,
  frequencyReuse,
}: {
  readonly source: SimState['physicalServing'];
  readonly servingCellId: number | null;
  readonly frequencyReuse: number;
}) {
  const hasCellSource = source.satId !== null && source.beamId === null && servingCellId !== null;
  const hasBeamSource = source.satId !== null && source.beamId !== null;
  const identity = hasCellSource
    ? formatCellServingIdentity(source.satId, servingCellId, frequencyReuse, 'No serving source yet')
    : hasBeamSource
      ? formatPanelBeamIdentity(source.satId, source.beamId, frequencyReuse, 'No physical serving source yet')
      : 'No serving source yet';

  return (
    <span
      style={{
        color: UI_TOKENS.color.text.secondary,
        fontSize: UI_TOKENS.type.size.body,
        lineHeight: 1.35,
        overflowWrap: 'anywhere',
      }}
    >
      {identity}
    </span>
  );
}

function FormulaValueRows({
  frame,
  tx,
}: {
  readonly frame: AngleAwareFormulaFrame | null | undefined;
  readonly tx: (key: string) => string;
}) {
  const terms = frame?.terms;
  return (
    <AngleAwareValueRows
      rows={[
        {
          testId: 'formula-frame-distance',
          symbol: <>d<sub>u,s,v</sub>(t)</>,
          label: tx('panel.activeFormula.distance'),
          scope: 'primary-ue',
          value: terms?.distanceM,
          kind: 'distance',
        },
        {
          testId: 'formula-frame-angle',
          symbol: <><LinkAngle /></>,
          label: tx('panel.activeFormula.angle'),
          scope: 'primary-ue',
          value: terms?.thetaRad,
          kind: 'angle',
        },
        {
          testId: 'formula-frame-power',
          symbol: <LinkRfPower />,
          label: tx('panel.activeFormula.rfPower'),
          scope: 'primary-ue',
          value: terms?.powerW,
          kind: 'power',
        },
        {
          testId: 'formula-frame-channel',
          symbol: <LinkChannel />,
          label: tx('panel.activeFormula.channel'),
          scope: 'primary-ue',
          value: terms?.channelGainLinear,
        },
        {
          testId: 'formula-frame-transmit-gain',
          symbol: <LinkTransmitGain />,
          label: tx('panel.activeFormula.transmitGain'),
          scope: 'primary-ue',
          value: terms?.transmitGainLinear,
        },
        {
          testId: 'formula-frame-interference',
          symbol: <LinkInterference />,
          label: tx('panel.activeFormula.interference'),
          scope: 'primary-ue',
          value: terms?.interferenceW,
          kind: 'power',
        },
        {
          testId: 'formula-frame-noise',
          symbol: <>σ²</>,
          label: tx('panel.activeFormula.noise'),
          scope: 'primary-ue',
          value: terms?.noiseW,
          kind: 'power',
        },
        {
          testId: 'formula-frame-sinr',
          symbol: <LinkSinr />,
          label: tx('panel.activeFormula.sinr'),
          scope: 'primary-ue',
          value: terms?.gammaLinear,
        },
      ]}
    />
  );
}

/** One right-rail SINR contract shared by the live frame and waiting state. */
export function FormulaTermsReadout({
  source,
  isFormulaEvidenceStale,
  frequencyReuse,
  servingCellId,
  formulaFrame,
  embedded = false,
}: {
  readonly source: SimState['physicalServing'];
  readonly budget: SimState['physicalServingBudget'];
  readonly isFormulaEvidenceStale: boolean;
  readonly frequencyReuse: number;
  readonly servingCellId: number | null;
  readonly formulaFrame?: AngleAwareFormulaFrame | null;
  readonly embedded?: boolean;
}) {
  const { tx } = usePanelCopy();
  const status = formulaStatus(formulaFrame, isFormulaEvidenceStale);
  const frameSinrDb = formulaFrame?.terms.gammaDb;
  const resultSinrDb = Number.isFinite(frameSinrDb) ? frameSinrDb : source.sinrDb;
  const resultLabel = status === 'current' && Number.isFinite(resultSinrDb)
    ? formatSinr(resultSinrDb ?? null)
    : statusCopy(status, tx);

  return (
    <div
      className="leo-formula-verification-card"
      data-testid="formula-verification-card"
      data-formula-evidence-status={status}
      data-embedded={embedded ? 'true' : 'false'}
      data-formula-contract="simplified-ee-c1-c9"
      data-formula-contract-version={formulaFrame?.terms.contractVersion ?? ''}
      style={{
        display: 'grid',
        gap: 10,
        minWidth: 0,
        marginTop: embedded ? 0 : 12,
        padding: embedded ? 0 : '13px 14px',
        borderRadius: UI_TOKENS.radius.lg,
        color: UI_TOKENS.color.text.primary,
        background: embedded
          ? 'transparent'
          : 'linear-gradient(180deg, rgba(8, 38, 44, 0.82), rgba(5, 15, 24, 0.72))',
        border: embedded ? 0 : '1px solid rgba(118, 234, 215, 0.2)',
      }}
    >
      {!embedded && (
        <strong style={{
          color: UI_TOKENS.color.semantic.tuningSoft,
          fontSize: UI_TOKENS.type.size.caption,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}>
          {tx('panel.formulaTerms.title')}
        </strong>
      )}
      <div className="leo-formula-verification-card__headline">
        <div className="leo-formula-verification-card__identity">
          <FormulaIdentity
            source={source}
            servingCellId={servingCellId}
            frequencyReuse={frequencyReuse}
          />
          <span style={{
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.caption,
            lineHeight: 1.35,
          }}>
            {statusCopy(status, tx)}
          </span>
        </div>
        <div
          data-testid="formula-result-readout"
          data-ownership="formula-verification"
          style={{
            display: 'grid',
            gap: 3,
            justifyItems: 'end',
            minWidth: 96,
            padding: '7px 9px',
            borderRadius: UI_TOKENS.radius.md,
            background: UI_TOKENS.color.surface.card,
            border: '1px solid rgba(118, 234, 215, 0.22)',
          }}
        >
          <span style={{
            color: UI_TOKENS.color.text.muted,
            fontSize: UI_TOKENS.type.size.tiny,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            {tx('panel.formulaTerms.result')}
          </span>
          <strong style={{
            color: status === 'current' ? sinrColor(resultSinrDb ?? -Infinity) : UI_TOKENS.color.text.faint,
            fontSize: UI_TOKENS.type.size.bodyLg,
            whiteSpace: 'nowrap',
          }}>
            {resultLabel}
          </strong>
        </div>
      </div>
      <FormulaValueRows frame={formulaFrame} tx={tx} />
    </div>
  );
}
