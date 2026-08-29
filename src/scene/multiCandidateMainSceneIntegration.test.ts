import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./MainScene.tsx', import.meta.url), 'utf8');
const railSource = await readFile(
  new URL('../ui/handover-evaluation/HandoverEvaluationPanel.tsx', import.meta.url),
  'utf8',
);
const publisherSource = await readFile(
  new URL('./useSimStatePublisher.ts', import.meta.url),
  'utf8',
);
const infoPanelSource = await readFile(
  new URL('../ui/InfoPanel.tsx', import.meta.url),
  'utf8',
);
const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const snapshotSource = await readFile(
  new URL('./acceptedHandoverPresentationSnapshot.ts', import.meta.url),
  'utf8',
);

test('MainScene mounts the bounded multi-candidate presentation from one accepted snapshot', () => {
  assert.doesNotMatch(source, /useHomepageCandidatePresentationPlan/);
  assert.match(source, /handoverCandidatePresentationPlan = acceptedHandoverPresentation\?\.plan \?\? null/);
  assert.match(publisherSource, /buildAcceptedHandoverPresentationSession\(\{/);
  assert.match(snapshotSource, /buildCandidatePresentationPlan\(input\.decision/);
  assert.match(source, /buildMultiCandidateScenePresentation\(handoverCandidatePresentationPlan\)/);
  assert.match(source, /<MultiCandidateBeamScene[\s\S]*presentation=\{multiCandidateScenePresentation\}/);
  assert.match(source, /onCandidateSelect=\{toggleInspectedCandidateKey\}/);
});

test('candidate authority is additive and cannot blanket-suppress the established carrier', () => {
  for (const carrier of [
    'OrbitTrail',
    'SpineParticles',
    'ServingGroundRipple',
  ]) {
    const blanketSuppression = new RegExp(
      `!multiCandidateAuthorityActive[\\s\\S]{0,320}${carrier}`,
    );
    assert.doesNotMatch(
      source,
      blanketSuppression,
      `${carrier} must not be disabled merely because a decision frame exists`,
    );
  }
  assert.match(
    source,
    /multiCandidateScenePresentation !== null[\s\S]*<MultiCandidateBeamScene/,
  );
  // MultiCandidateBeamScene owns candidate evidence and the authoritative data
  // link, but the established serving cone + footprint stay mounted.
  assert.match(source, /resolveMultiCandidateBeamScene\(\{/);
  assert.match(source, /renderServingConeAndFootprint=\{false\}/);
  assert.doesNotMatch(
    source,
    /\(!multiCandidateAuthorityActive \|\| !multiCandidateServingCarrierRenderable\)[\s\S]{0,180}presentationPlan\.visible\['serving-beams'\]/,
  );
  assert.doesNotMatch(
    source,
    /\(!multiCandidateAuthorityActive \|\| !multiCandidateServingCarrierRenderable\)[\s\S]{0,180}presentationPlan\.visible\['serving-footprints'\]/,
  );
  assert.match(source, /multiCandidateServingCarrierRenderable/);
  assert.match(
    source,
    /satelliteTintColor=\{multiCandidateAuthorityActive \? undefined : sat\.satelliteTintColor\}[\s\S]{0,120}showLabel=\{!multiCandidateAuthorityActive\}/,
  );
  // The established pulse/cross-fade carriers remain mounted. Candidate
  // authority may replace only their role hue with stable satellite/beam
  // identity; it must not erase the animation.
  assert.doesNotMatch(source, /multiCandidateAuthorityActive \? \[\] : sinrLiveCellPulseConeItems/);
  assert.doesNotMatch(source, /multiCandidateAuthorityActive \? \[\] : triggeredIntraConeItems/);
  assert.doesNotMatch(source, /multiCandidateAuthorityActive \? \[\] : sinrLiveCinemaHandoverPairConeItems/);
  assert.match(
    source,
    /const additiveHandoverPulseConeItems = useMemo\([\s\S]{0,520}sinrLiveCellPulseConeItems[\s\S]{0,320}\.map\(item => \(\{/,
  );
  assert.match(
    source,
    /acceptedHandoverPresentation\?\.commit,[\s\S]{0,120}handoverPresentation\.event/,
  );
  assert.match(source, /triggeredIntraConeItems\.map\(item => \(\{/);
  assert.match(source, /sinrLiveCinemaHandoverPairConeItems\.map\(item => \(\{/);
  assert.match(source, /candidate: handoverPresentationCandidate/);
  assert.match(source, /handoverPresentationStep = advanceHandoverPresentation\(/);
  assert.doesNotMatch(source, /resolveAuthorityHandoverPresentationSnapshot\(/);
  assert.match(source, /const authorityHandoverPairConeItems = useMemo/);
  const authorityPairBlock = source.slice(
    source.indexOf('const authorityHandoverPairConeItems = useMemo'),
    source.indexOf('const latchedAuthorityTransition = useMemo'),
  );
  assert.doesNotMatch(authorityPairBlock, /handoverPresentation\.event\?\.kind !== 'intra'/);
  assert.match(authorityPairBlock, /presentedHandoverPairCandidate\.kind !== 'inter'/);
  assert.match(authorityPairBlock, /authorityPresentationCommitObserved[\s\S]{0,160}toSatId[\s\S]{0,160}fromSatId/);
  assert.match(
    source,
    /telemetryCountDatasetKey="multiCandidateAuthorityTransitionConeRenderedCount"/,
  );
  assert.match(source, /<DecisionHandoverCue/);
  assert.match(source, /const latchedAuthorityTransition = useMemo/);
  assert.match(source, /progress01=\{handoverPresentation\.progress01\}/);
  assert.doesNotMatch(
    source,
    /showLiveSceneEffects[\s\S]{0,100}!multiCandidateAuthorityActive[\s\S]{0,180}<IntraGroundShockwave/,
  );
  assert.match(
    source,
    /!multiCandidateAuthorityActive \|\| handoverPresentation\.active/,
  );
  assert.doesNotMatch(
    source,
    /authorityHandoverPairConeItems[\s\S]{0,420}handoverAuthorityJoin\?\.showTransitionCue !== true/,
  );
});

test('scene telemetry exposes rendered-output recovery and one-link browser gates', () => {
  assert.match(source, /buildCandidateSceneRenderReceipt\(\{/);
  assert.match(source, /renderReceipt=\{multiCandidateSceneRenderReceipt\}/);
  assert.match(
    source,
    /multiCandidateRenderedPairCount=\{String\(\s*multiCandidateSceneRenderPlan\?\.telemetry\.renderedPairCount \?\? 0\s*\)\}/,
  );
  assert.match(
    source,
    /multiCandidateSceneGlobalSolidDataLinkCount=\{String\(\s*multiCandidateSceneRenderPlan\?\.solidDataLinkCount \?\? 0\s*\)\}/,
  );
  assert.match(
    source,
    /multiCandidateCarrierFallbackActive=\{\s*multiCandidateAuthorityActive && !multiCandidateServingCarrierRenderable \? '1' : '0'\s*\}/,
  );
  assert.match(source, /multiCandidateEventCueCount=\{String\(multiCandidateEventCueCount\)\}/);
  assert.match(source, /presentationPlan\.visible\['serving-beams'\][\s\S]{0,160}<SinrLiveCellBeamCones/);
});

test('multi-candidate camera auto-refit is fully disabled without episode resets', () => {
  assert.match(
    source,
    /const MULTI_CANDIDATE_AUTO_CAMERA_REFIT_ENABLED = false/,
  );
  assert.doesNotMatch(source, /multiCandidateCameraRecoveryEpisodeRef/);
  assert.match(
    source,
    /multiCandidateCameraUserControlledRef\.current = true/,
  );
});

test('scene and right rail consume the exact same accepted plan without rebuilding it', () => {
  assert.doesNotMatch(source, /useHomepageCandidatePresentationPlan/);
  assert.doesNotMatch(railSource, /useHomepageCandidatePresentationPlan/);
  assert.doesNotMatch(railSource, /buildCandidatePresentationPlan/);
  assert.match(railSource, /const plan = snapshot\.plan/);
  assert.match(infoPanelSource, /<HandoverEvaluationPanel snapshot=\{acceptedHandoverPresentation\}/);
  assert.match(appSource, /acceptedHandoverPresentation=\{simState\.acceptedHandoverPresentation \?\? null\}/);
  assert.match(
    source,
    /data-accepted-handover-snapshot-id=\{acceptedHandoverPresentation\?\.snapshotId \?\? ''\}/,
  );
  assert.match(source, /acceptedHandoverPresentation: AcceptedHandoverPresentationSnapshot \| null/);
  assert.doesNotMatch(source, /const acceptedHandoverPresentationSession = useSimStatePublisher/);
  assert.match(publisherSource, /acceptedHandoverPresentation:\s*acceptedHandoverPresentationSession\?\.snapshot \?\? null/);
  assert.match(snapshotSource, /readonly plan: CandidatePresentationPlan/);
  assert.doesNotMatch(source, /multiCandidateIdentityRef/);
  assert.doesNotMatch(railSource, /previousIdentityAllocation/);
  assert.match(railSource, /data-satellite-identity-colors=/);
});

test('authority presentation prioritizes actual switching while admitting manual and cinema demos during evaluation', () => {
  // Real authority switching event takes precedence over manual/cinema candidates
  assert.match(
    source,
    /if \(authorityHandoverPresentationCandidate !== null\) \{\s*return authorityHandoverPresentationCandidate;\s*\}/,
  );
  // Manual handover is admitted when authority has no active switching event
  assert.match(
    source,
    /if \(manualHandoverActive && manualHandoverEvent !== null\)/,
  );
  // Cinema handover is admitted when authority has no active switching event
  assert.match(
    source,
    /if \(cinemaHandoverReady && cinemaPairCandidate !== null\)/,
  );
  // Natural background events are suppressed under candidate authority when no manual request is active
  assert.match(
    source,
    /const naturalCandidate = \(multiCandidateAuthorityActive \|\| recentPrimaryHandoverEvent === null\)\s*\?\s*null/,
  );
  // Must NOT blanket early-return authorityHandoverPresentationCandidate when null
  assert.doesNotMatch(
    source,
    /if \(multiCandidateAuthorityActive\) return authorityHandoverPresentationCandidate;/,
  );
});
