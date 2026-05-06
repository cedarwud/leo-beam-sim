import assert from 'node:assert/strict';
import {
  BEAM_PULSE_SPECS,
  BEAM_ROLE_TOKENS,
  beamVisualRoleForEventRole,
  frequencyReuseColor,
  operatorLabelForEventRole,
  resolveBeamVisualEncoding,
  type BeamCodeRole,
  type BeamVisualEncoding,
} from '../src/constants/beamRoleTokens.ts';
import { formatBeamIdentityLabel } from '../src/utils/beamFrequency.ts';

const FORBIDDEN_RAW_ROLE_LABELS = ['prepared', 'secondary', 'post-ho'] as const;

type FixtureName =
  | 'pending handover'
  | 'approach / pre-illumination'
  | 'recent HO source'
  | 'inactive / unscheduled primary beam';

interface ForcedRoleFixture {
  name: FixtureName;
  codeRole: BeamCodeRole;
  beamId: number;
  frequencyIndex: number;
  isPrimary: boolean;
  isServing: boolean;
  isScheduledActive: boolean;
  expectedOperatorLabel: string;
  expectedMarkerLabel: string;
  expectedVisualRole: string;
  expectedSlotStateLabel?: 'SLOT OFF' | 'UNSCHEDULED';
}

interface RenderedFixture {
  fixture: ForcedRoleFixture;
  encoding: BeamVisualEncoding;
  beamIdentityLabel: string;
  userFacingText: string;
}

const fixtures: ForcedRoleFixture[] = [
  {
    name: 'pending handover',
    codeRole: 'prepared',
    beamId: 2,
    frequencyIndex: 0,
    isPrimary: true,
    isServing: false,
    isScheduledActive: true,
    expectedOperatorLabel: 'PENDING',
    expectedMarkerLabel: 'PENDING',
    expectedVisualRole: 'pending',
  },
  {
    name: 'approach / pre-illumination',
    codeRole: 'approach',
    beamId: 4,
    frequencyIndex: 1,
    isPrimary: true,
    isServing: false,
    isScheduledActive: true,
    expectedOperatorLabel: 'APPROACH',
    expectedMarkerLabel: 'APPROACH',
    expectedVisualRole: 'approach',
  },
  {
    name: 'recent HO source',
    codeRole: 'secondary',
    beamId: 6,
    frequencyIndex: 2,
    isPrimary: true,
    isServing: false,
    isScheduledActive: true,
    expectedOperatorLabel: 'SOURCE',
    expectedMarkerLabel: 'HO SOURCE',
    expectedVisualRole: 'recentSource',
  },
  {
    name: 'inactive / unscheduled primary beam',
    codeRole: 'prepared',
    beamId: 5,
    frequencyIndex: 2,
    isPrimary: true,
    isServing: false,
    isScheduledActive: false,
    expectedOperatorLabel: 'PENDING',
    expectedMarkerLabel: 'PENDING',
    expectedVisualRole: 'pending',
    expectedSlotStateLabel: 'SLOT OFF',
  },
];

function renderFixture(fixture: ForcedRoleFixture): RenderedFixture {
  const encoding = resolveBeamVisualEncoding({
    role: fixture.codeRole,
    isPrimary: fixture.isPrimary,
    isServing: fixture.isServing,
    isScheduledActive: fixture.isScheduledActive,
    frequencyColor: frequencyReuseColor(fixture.frequencyIndex),
  });
  const beamIdentityLabel = formatBeamIdentityLabel(fixture.frequencyIndex, fixture.beamId);
  const labelParts = [
    encoding.operatorLabel,
    beamIdentityLabel,
    encoding.slotStateLabel,
  ].filter((part): part is string => Boolean(part));
  const markerLabel = operatorLabelForEventRole(fixture.codeRole, true);
  const linkLabel = [
    operatorLabelForEventRole(fixture.codeRole),
    beamIdentityLabel,
  ].filter((part): part is string => Boolean(part)).join(' ');

  return {
    fixture,
    encoding,
    beamIdentityLabel,
    userFacingText: [
      labelParts.join(' '),
      markerLabel,
      linkLabel,
    ].filter(Boolean).join(' | '),
  };
}

function assertNoRawCodeRoles(rendered: RenderedFixture): void {
  const normalized = rendered.userFacingText.toLowerCase();
  for (const forbidden of FORBIDDEN_RAW_ROLE_LABELS) {
    assert.ok(
      !normalized.includes(forbidden),
      `${rendered.fixture.name} leaked raw code role "${forbidden}" in user-facing text: ${rendered.userFacingText}`,
    );
  }
}

function assertFrequencyIdentity(rendered: RenderedFixture): void {
  assert.match(
    rendered.beamIdentityLabel,
    /^F\d+ B\d+$/,
    `${rendered.fixture.name} did not format beam identity as F# B#: ${rendered.beamIdentityLabel}`,
  );
  assert.ok(
    rendered.userFacingText.includes(rendered.beamIdentityLabel),
    `${rendered.fixture.name} did not preserve ${rendered.beamIdentityLabel} in user-facing text`,
  );
}

function assertExpectedRoleLabels(rendered: RenderedFixture): void {
  assert.equal(
    beamVisualRoleForEventRole(rendered.fixture.codeRole),
    rendered.fixture.expectedVisualRole,
    `${rendered.fixture.name} mapped to the wrong visual role`,
  );
  assert.equal(
    rendered.encoding.operatorLabel,
    rendered.fixture.expectedOperatorLabel,
    `${rendered.fixture.name} used the wrong operator label`,
  );
  assert.equal(
    operatorLabelForEventRole(rendered.fixture.codeRole, true),
    rendered.fixture.expectedMarkerLabel,
    `${rendered.fixture.name} used the wrong marker label`,
  );
  if (rendered.fixture.expectedSlotStateLabel) {
    assert.equal(
      rendered.encoding.slotStateLabel,
      rendered.fixture.expectedSlotStateLabel,
      `${rendered.fixture.name} did not expose the expected slot-state label`,
    );
  }
}

function assertNonColorEncoding(rendered: RenderedFixture): void {
  const { fixture, encoding } = rendered;

  switch (fixture.name) {
    case 'pending handover':
      assert.equal(encoding.dashed, false, 'pending handover must be solid after Phase 2 dash reassignment');
      assert.equal(encoding.pulse, 'breathe', 'pending handover must use the breathe pulse cue');
      assert.equal(BEAM_PULSE_SPECS.breathe.periodSec, 2.4, 'pending breathe period drifted');
      assert.equal(BEAM_PULSE_SPECS.breathe.amplitude, 0.06, 'pending breathe amplitude drifted');
      assert.ok(encoding.lineWidth > 2, 'pending handover must use more than color for line emphasis');
      assert.equal(encoding.endpointFilled, true, 'pending handover must use filled endpoint emphasis');
      break;
    case 'approach / pre-illumination':
      assert.equal(encoding.dashed, false, 'approach must be solid after Phase 2 dash reassignment');
      assert.equal(encoding.pulse, 'pulse', 'approach must use the pulse cue');
      assert.equal(BEAM_PULSE_SPECS.pulse.periodSec, 1.4, 'approach pulse period drifted');
      assert.equal(BEAM_PULSE_SPECS.pulse.amplitude, 0.05, 'approach pulse amplitude drifted');
      assert.equal(encoding.endpointFilled, false, 'approach must use hollow endpoint encoding');
      assert.ok(encoding.coneOpacity < 0.3, 'approach must use reduced opacity/fade encoding');
      break;
    case 'recent HO source':
      assert.equal(encoding.dashed, false, 'recent HO source must be solid after Phase 2 dash reassignment');
      assert.equal(encoding.pulse, 'fade', 'recent HO source must use the linger fade cue');
      assert.equal(BEAM_PULSE_SPECS.fade.periodSec, 2, 'recent HO fade window drifted');
      assert.equal(BEAM_PULSE_SPECS.fade.amplitude, 0.06, 'recent HO fade amplitude drifted');
      assert.equal(encoding.endpointFilled, false, 'recent HO source must use outline endpoint encoding');
      assert.ok(encoding.lineOpacity < 0.7, 'recent HO source must use fade/opacity de-emphasis');
      break;
    case 'inactive / unscheduled primary beam':
      assert.equal(encoding.dashed, true, 'unscheduled primary beam must use dashed inactive encoding');
      assert.equal(encoding.pulse, 'breathe', 'off-slot pending keeps the role pulse while dash remains a slot-state override');
      assert.equal(encoding.endpointFilled, false, 'unscheduled primary beam must use hollow endpoint encoding');
      assert.ok(encoding.lineOpacity < 0.7, 'unscheduled primary beam must use reduced line opacity');
      assert.ok(
        encoding.slotStateLabel === 'SLOT OFF' || encoding.slotStateLabel === 'UNSCHEDULED',
        'unscheduled primary beam must expose SLOT OFF or UNSCHEDULED label text',
      );
      break;
    default:
      assert.fail(`unhandled fixture ${(fixture as { name: string }).name}`);
  }
}

function assertDashContract(): void {
  for (const [visualRole, token] of Object.entries(BEAM_ROLE_TOKENS)) {
    if (visualRole === 'inactive') {
      assert.equal(token.dashed, true, 'inactive must remain the only role-level dashed token');
      assert.equal(token.pulse, 'none', 'inactive must not pulse');
      continue;
    }

    assert.equal(token.dashed, false, `${visualRole} must not own the dash channel`);
  }
}

function run(): void {
  const renderedFixtures = fixtures.map(renderFixture);
  assertDashContract();

  for (const rendered of renderedFixtures) {
    assertExpectedRoleLabels(rendered);
    assertNoRawCodeRoles(rendered);
    assertFrequencyIdentity(rendered);
    assertNonColorEncoding(rendered);
  }

  console.log('Phase 2D forced role-state visual validation passed.');
  console.log(JSON.stringify({
    coveredStates: renderedFixtures.map(rendered => ({
      state: rendered.fixture.name,
      label: rendered.encoding.operatorLabel,
      beamIdentity: rendered.beamIdentityLabel,
      slotState: rendered.encoding.slotStateLabel,
      nonColorEncoding: {
        lineWidth: rendered.encoding.lineWidth,
        dashed: rendered.encoding.dashed,
        pulse: rendered.encoding.pulse,
        endpointFilled: rendered.encoding.endpointFilled,
        lineOpacity: rendered.encoding.lineOpacity,
        coneOpacity: rendered.encoding.coneOpacity,
      },
    })),
    forbiddenRawRoleLeakCheck: 'passed',
  }, null, 2));
}

run();
