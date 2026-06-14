import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  frequencyReuseColor,
  resolveBeamVisualEncoding,
  type BeamCodeRole,
} from '../src/constants/beamRoleTokens.ts';
import { getFormulaFamilyLabel, loadProfile } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import type { LinkBudgetTerms, SimState } from '../src/scene/types.ts';
import { DiagnosticsDrawer } from '../src/ui/DiagnosticsDrawer.tsx';
import { InfoPanel } from '../src/ui/InfoPanel.tsx';
import { BeamCalloutContent, type BeamTarget } from '../src/viz/SatelliteBeams.tsx';
import {
  formatBeamIdentity,
  formatBeamIdentityByIndex,
  formatSatelliteLabel,
} from '../src/utils/formatSatelliteLabel.ts';
import { formatBeamIdentityLabel } from '../src/utils/beamFrequency.ts';

const PROFILE_ID = 'hobs-2024-candidate-rich';
const SERVING_SAT_ID = 'shell-pro-53-P0-S3';
const PENDING_SAT_ID = 'shell-retro000-P4-S10';
const APPROACH_SAT_ID = 'shell-polar-090-P0-S3';
const SOURCE_SAT_ID = 'shell-pro-53-P1-S0';
const AMBIENT_SAT_ID = 'shell-pro-53-P2-S1';
const SERVING_BEAM_ID = 5;
const PENDING_BEAM_ID = 11;
const APPROACH_BEAM_ID = 4;
const SOURCE_BEAM_ID = 6;
const AMBIENT_BEAM_ID = 7;

interface CalloutFixture {
  name: string;
  satId: string;
  beamId: number;
  frequencyIndex: number;
  role?: BeamCodeRole;
  isPrimary: boolean;
  isServing: boolean;
  isScheduledActive: boolean;
  sinrDb: number | null;
}

function decodeHtmlText(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTagByTestId(markup: string, testId: string): string {
  const match = markup.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`));
  assert.ok(match, `expected rendered markup to include data-testid="${testId}"`);
  return match[0];
}

function extractAttr(markup: string, attr: string): string {
  const match = markup.match(new RegExp(`${attr}="([^"]*)"`));
  assert.ok(match, `expected rendered markup to include ${attr}`);
  return match[1];
}

function assertContains(text: string, expected: string): void {
  assert.ok(text.includes(expected), `expected rendered output to contain "${expected}"\nRendered: ${text}`);
}

function createBudgetTerms(seed: number): LinkBudgetTerms {
  return {
    signalDbm: -92 + seed,
    intraInterferenceDbm: -118 + seed,
    interInterferenceDbm: -116 + seed,
    noiseDbm: -104,
    denominatorDbm: -103 + seed,
    txPowerDbm: 50,
    pathLossDb: 152 - seed,
    beamGainDb: 39,
    steeringLossDb: 1,
    receiverGainDbi: 0,
  };
}

function profileWithFrequencyReuse(frequencyReuse: number): Profile {
  const base = loadProfile(PROFILE_ID);
  return {
    ...base,
    beams: {
      ...base.beams,
      frequencyReuse,
    },
  };
}

function createPanelState(profile: Profile, mode: 'pending' | 'recent-ho'): SimState {
  const isRecentHo = mode === 'recent-ho';
  const primarySatId = isRecentHo ? SOURCE_SAT_ID : SERVING_SAT_ID;
  const primaryBeamId = isRecentHo ? SOURCE_BEAM_ID : SERVING_BEAM_ID;
  const comparisonSatId = isRecentHo ? PENDING_SAT_ID : PENDING_SAT_ID;
  const comparisonBeamId = isRecentHo ? PENDING_BEAM_ID : PENDING_BEAM_ID;

  return {
    profileId: profile.id,
    formulaFamilyLabel: getFormulaFamilyLabel(profile.formulaFamily),
    physicalServing: {
      satId: isRecentHo ? PENDING_SAT_ID : SERVING_SAT_ID,
      beamId: isRecentHo ? PENDING_BEAM_ID : SERVING_BEAM_ID,
      sinrDb: 18.4,
      elevationDeg: 54.2,
      rangeKm: 870,
      status: 'live',
    },
    panelPrimary: {
      role: isRecentHo ? 'ho-source' : 'serving',
      satId: primarySatId,
      beamId: primaryBeamId,
      sinrDb: isRecentHo ? 12.1 : 18.4,
      elevationDeg: 50.1,
      rangeKm: 900,
      status: isRecentHo ? 'recent-ho' : 'live',
    },
    panelComparison: {
      role: isRecentHo ? 'ho-target' : 'pending',
      satId: comparisonSatId,
      beamId: comparisonBeamId,
      sinrDb: 21.2,
      elevationDeg: 56.4,
      rangeKm: 820,
      status: isRecentHo ? 'recent-ho' : 'live',
    },
    servingSatId: primarySatId,
    servingBeamId: primaryBeamId,
    servingElevationDeg: 50.1,
    servingRangeKm: 900,
    pendingTargetSatId: isRecentHo ? null : comparisonSatId,
    pendingTargetBeamId: isRecentHo ? null : comparisonBeamId,
    pendingTargetSinrDb: isRecentHo ? null : 21.2,
    comparisonSatId,
    comparisonBeamId,
    comparisonElevationDeg: 56.4,
    comparisonRangeKm: 820,
    comparisonSinrDb: 21.2,
    comparisonKind: isRecentHo ? 'recent-ho' : 'pending',
    sinrDeltaDb: 2.8,
    recentHoSourceSatId: isRecentHo ? primarySatId : null,
    recentHoTargetSatId: isRecentHo ? comparisonSatId : null,
    sinrDb: isRecentHo ? 12.1 : 18.4,
    physicalServingBudget: createBudgetTerms(0),
    servingBudget: createBudgetTerms(1),
    handoverOffsetDb: profile.handover.offsetDb,
    handoverTriggerProgressSec: isRecentHo ? 0 : 1.2,
    handoverTriggerSec: profile.handover.triggerTimeSec,
    hoCount: isRecentHo ? 1 : 0,
    intraHoCount: 0,
    simTimeSec: 30,
    lastHoEvent: null,
    intraHandoverEvent: null,
    lastHoReason: `inter-HO: ${comparisonSatId} B${comparisonBeamId}, 1.2/${profile.handover.triggerTimeSec.toFixed(1)}s`,
    beamHopEnabled: profile.beamHopping.enabled,
    beamHopSlotIndex: 12,
    beamHopSlotSec: profile.beamHopping.slotSec,
    servingBeamActiveThisSlot: true,
    servingSatActiveBeamIds: [primaryBeamId],
    pendingTargetActiveBeamIds: [comparisonBeamId],
  };
}

function renderCallout(fixture: CalloutFixture): { markup: string; text: string } {
  const style = resolveBeamVisualEncoding({
    role: fixture.role,
    isPrimary: fixture.isPrimary,
    isServing: fixture.isServing,
    isScheduledActive: fixture.isScheduledActive,
    frequencyColor: frequencyReuseColor(fixture.frequencyIndex),
  });
  const beam: Pick<BeamTarget, 'beamId' | 'frequencyIndex'> = {
    beamId: fixture.beamId,
    frequencyIndex: fixture.frequencyIndex,
  };
  const markup = renderToStaticMarkup(
    <BeamCalloutContent
      satelliteId={fixture.satId}
      beam={beam}
      style={style}
      color={style.color}
      sinrLabel={fixture.sinrDb === null ? '-- dB' : `${fixture.sinrDb.toFixed(1)} dB`}
      isEmphasized={style.isEmphasized}
    />,
  );

  return { markup, text: decodeHtmlText(markup) };
}

function assertHelperExamples(): void {
  assert.equal(
    formatBeamIdentity({ satId: 'shell-pro-53-P0-S3', beamId: 5, frequencyReuse: 3 }),
    'G53-01-04 · F2 B5',
  );
  assert.equal(
    formatBeamIdentity({ satId: 'shell-retro000-P4-S10', beamId: 11, frequencyReuse: 4 }),
    'R000-05-11 · F3 B11',
  );
  assert.equal(
    formatBeamIdentity({ satId: 'shell-polar-090-P0-S3', beamId: 5, frequencyReuse: 3 }),
    'P090-01-04 · F2 B5',
  );
  assert.equal(
    formatBeamIdentity({ satId: null, beamId: 5, frequencyReuse: 3 }),
    '— · F2 B5',
  );
}

function assertCalloutIdentities(): void {
  const fixtures: CalloutFixture[] = [
    {
      name: 'serving beam',
      satId: SERVING_SAT_ID,
      beamId: SERVING_BEAM_ID,
      frequencyIndex: 1,
      role: 'serving',
      isServing: true,
      isPrimary: true,
      isScheduledActive: true,
      sinrDb: 18.4,
    },
    {
      name: 'pending handover',
      satId: PENDING_SAT_ID,
      beamId: PENDING_BEAM_ID,
      frequencyIndex: 2,
      role: 'prepared',
      isServing: false,
      isPrimary: true,
      isScheduledActive: true,
      sinrDb: 21.2,
    },
    {
      name: 'approach / pre-illumination',
      satId: APPROACH_SAT_ID,
      beamId: APPROACH_BEAM_ID,
      frequencyIndex: 0,
      role: 'approach',
      isServing: false,
      isPrimary: true,
      isScheduledActive: true,
      sinrDb: 9.6,
    },
    {
      name: 'recent HO source',
      satId: SOURCE_SAT_ID,
      beamId: SOURCE_BEAM_ID,
      frequencyIndex: 1,
      role: 'secondary',
      isServing: false,
      isPrimary: true,
      isScheduledActive: true,
      sinrDb: 12.1,
    },
    {
      name: 'ambient active beam',
      satId: AMBIENT_SAT_ID,
      beamId: AMBIENT_BEAM_ID,
      frequencyIndex: 2,
      isServing: false,
      isPrimary: false,
      isScheduledActive: true,
      sinrDb: 6.4,
    },
  ];

  for (const fixture of fixtures) {
    const { markup, text } = renderCallout(fixture);
    const satelliteLabel = formatSatelliteLabel(fixture.satId);
    const beamToken = formatBeamIdentityLabel(fixture.frequencyIndex, fixture.beamId);
    const identity = formatBeamIdentityByIndex({
      satId: fixture.satId,
      beamId: fixture.beamId,
      frequencyIndex: fixture.frequencyIndex,
    });

    assert.equal(
      extractAttr(markup, 'data-satellite-label'),
      satelliteLabel,
      `${fixture.name} did not expose the satellite owner chip label`,
    );
    assert.equal(
      extractAttr(markup, 'data-beam-identity'),
      identity,
      `${fixture.name} did not expose the canonical beam identity`,
    );
    assert.ok(text.startsWith(satelliteLabel), `${fixture.name} callout did not start with ${satelliteLabel}: ${text}`);
    assertContains(text, beamToken);

    if (fixture.role || fixture.isServing) {
      const style = resolveBeamVisualEncoding({
        role: fixture.role,
        isPrimary: fixture.isPrimary,
        isServing: fixture.isServing,
        isScheduledActive: fixture.isScheduledActive,
        frequencyColor: frequencyReuseColor(fixture.frequencyIndex),
      });
      assert.ok(style.operatorLabel, `${fixture.name} expected an operator role label`);
      assertContains(text, style.operatorLabel);
    }
  }
}

function assertInfoPanelIdentities(): void {
  const profile = profileWithFrequencyReuse(4);
  const pendingState = createPanelState(profile, 'pending');
  const servingIdentity = formatBeamIdentity({
    satId: SERVING_SAT_ID,
    beamId: SERVING_BEAM_ID,
    frequencyReuse: profile.beams.frequencyReuse,
  });
  const pendingIdentity = formatBeamIdentity({
    satId: PENDING_SAT_ID,
    beamId: PENDING_BEAM_ID,
    frequencyReuse: profile.beams.frequencyReuse,
  });
  const pendingMarkup = renderToStaticMarkup(
    <>
      <InfoPanel {...pendingState} uiMode="diagnostics" profile={profile} />
      <DiagnosticsDrawer {...pendingState} uiMode="diagnostics" profile={profile} />
    </>,
  );
  const pendingText = decodeHtmlText(pendingMarkup);

  assert.equal(
    extractAttr(extractTagByTestId(pendingMarkup, 'info-panel-primary-beam-identity'), 'data-beam-identity'),
    servingIdentity,
  );
  assert.equal(
    extractAttr(extractTagByTestId(pendingMarkup, 'info-panel-comparison-beam-identity'), 'data-beam-identity'),
    pendingIdentity,
  );
  assertContains(pendingText, 'ACTIVE SERVING');
  assertContains(pendingText, 'PENDING TARGET');
  assertContains(pendingText, servingIdentity);
  assertContains(pendingText, pendingIdentity);
  assertContains(pendingText, `inter-HO: ${pendingIdentity}`);

  const recentHoState = createPanelState(profile, 'recent-ho');
  const sourceIdentity = formatBeamIdentity({
    satId: SOURCE_SAT_ID,
    beamId: SOURCE_BEAM_ID,
    frequencyReuse: profile.beams.frequencyReuse,
  });
  const recentHoMarkup = renderToStaticMarkup(
    <>
      <InfoPanel {...recentHoState} uiMode="diagnostics" profile={profile} />
      <DiagnosticsDrawer {...recentHoState} uiMode="diagnostics" profile={profile} />
    </>,
  );
  const recentHoText = decodeHtmlText(recentHoMarkup);

  assertContains(recentHoText, 'HO SOURCE');
  assertContains(recentHoText, 'HO TARGET');
  assertContains(recentHoText, sourceIdentity);
  assertContains(recentHoText, pendingIdentity);
  assertContains(recentHoText, `${sourceIdentity} → ${pendingIdentity}`);
}

function run(): void {
  assertHelperExamples();
  assertCalloutIdentities();
  assertInfoPanelIdentities();

  console.log('Visual Clarity Phase 1A live-legend identity validation passed.');
  console.log(JSON.stringify({
    helperExamples: 'passed',
    calloutFixtures: ['serving', 'pending', 'approach', 'recent HO source', 'ambient active'],
    panelRows: ['ACTIVE SERVING', 'PENDING TARGET', 'HO SOURCE', 'HO TARGET', 'Recent HO', 'Last Reason'],
    result: 'PASS',
  }, null, 2));
}

run();
