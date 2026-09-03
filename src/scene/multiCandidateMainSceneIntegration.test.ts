import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resolveGroundRippleTargets } from '../viz/ServingGroundRipple';
import { resolveIntraGroundShockwaveColors } from '../viz/IntraGroundShockwave';
import type { BeamTarget } from './beamTargetTypes';

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
  assert.match(
    source,
    /const handoverCandidatePresentationPlan = multiCandidateAuthorityActive\s*\n\s*\? acceptedHandoverPresentation\?\.plan \?\? null\s*\n\s*: null/,
  );
  assert.match(publisherSource, /buildAcceptedHandoverPresentationSession\(\{/);
  assert.match(snapshotSource, /buildCandidatePresentationPlan\(input\.decision/);
  assert.match(
    publisherSource,
    /displayAllHardEligibleCandidates:\s*true,[\s\S]{0,240}displayOnlyTriggerSatisfiedCandidates:\s*true,/,
    'homepage rail must expose only hard-eligible alternatives that also satisfy the active trigger',
  );
  assert.match(source, /buildMultiCandidateScenePresentation\(handoverCandidatePresentationPlan\)/);
  assert.match(source, /<MultiCandidateBeamScene[\s\S]*presentation=\{multiCandidateScenePresentationForRender\}/);
  assert.match(source, /onCandidateSelect=\{toggleInspectedCandidateKey\}/);
  assert.equal(
    (source.match(/renderSatelliteIdentityLabels=\{false\}/g) ?? []).length,
    2,
    'homepage candidate layers must not mount duplicate camera-projected identity windows',
  );
  assert.match(source, /labelFontSize=\{homepageSatelliteLabelActive[\s\S]*satelliteCandidateLabelActive \? 22 : 18/);
  assert.match(source, /labelColor=\{homepageSatelliteLabelActive \? '#f8fafc' : undefined\}/);
});

test('homepage transition colours stay on the accepted EE shade projection', () => {
  const resolverStart = source.indexOf('const resolveSceneAcceptedBeamColor');
  const resolverEnd = source.indexOf('const resolveSceneAcceptedCellColor', resolverStart);
  const resolver = source.slice(resolverStart, resolverEnd);
  assert.match(
    resolver,
    /homepageSatelliteColorForBeam\([\s\S]*eeNormalized:\s*homepageBeamEeByKey\?\.get\(/,
    'scene transition colours must not fall back to beam-slot shading when the homepage publishes EE',
  );
  assert.match(
    source,
    /const multiCandidateBeamColorBySatelliteCell = useMemo\([\s\S]*instruction\.isServing \|\| instruction\.isCandidate[\s\S]*link\.isServing \|\| link\.isCandidate/,
    'the source/target cue must keep both presented endpoints vivid while preserving their satellite hue families',
  );
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
  assert.match(
    source,
    /plans=\{multiCandidateCentralOverlayActive\s*\?[\s\S]{0,140}sinrLiveCellTruthSpineParticlePlans\}/,
    'live streaming particles must use the visible cell-truth beam plan outside the comparison overlay',
  );
  // The accepted comparison layer owns candidate geometry. The homepage keeps
  // the established serving fan as its additive carrier; handover-time mutual
  // exclusion is asserted by the homepage geometry policy instead of by this
  // candidate-scene mount.
  assert.match(source, /resolveMultiCandidateBeamScene\(\{/);
  assert.match(source, /renderServingConeAndFootprint=\{!homepageVisualIdentity\}/);
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
    /satelliteTintColor=\{multiCandidateSceneVisualActive[\s\S]{0,180}multiCandidateSatelliteColorById\.get\(sat\.id\)/,
  );
  assert.match(source, /scaleMultiplier=\{multiCandidateSceneVisualActive\s*\? MULTI_CANDIDATE_SATELLITE_SCALE_MULTIPLIER\s*:\s*1\}/);
  // Satellite/beam identity colour belongs only to the active serving pair and
  // explicitly presented candidate pairs. The rest of the serving satellite's
  // fan must retain the semantic neutral treatment.
  assert.match(source, /const multiCandidateServingBeamColor = multiCandidateSceneRenderPlan\?\.instructions\.find/);
  assert.match(source, /heroColor: multiCandidateServingBeamColor\s*\n\s*\?\? sinrLiveConePalette\.heroColor/);
  assert.doesNotMatch(source, /items\.map\(item => \{[\s\S]{0,500}beamIdentitiesBySatelliteId/);
  assert.match(source, /palette=\{activeServingConePalette\}[\s\S]{0,100}colorAuthority="item-identity"/);
  // Beam Info is an explicit scene control and remains available while the
  // accepted candidate snapshot is active. It reads the same rendered cone
  // items, while the callout renderer filters geometry-only substrate entries
  // so the scene never presents synthetic measurement cards.
  assert.match(source, /showBeamCallouts[\s\S]*?SinrLiveCellBeamCallouts/);
  const beamInfoBlock = source.slice(
    source.indexOf('{showBeamCallouts'),
    source.indexOf('/* G2c ambient live-handover pulse', source.indexOf('{showBeamCallouts')),
  );
  assert.doesNotMatch(beamInfoBlock, /!multiCandidateAuthorityActive/);
  assert.match(beamInfoBlock, /items=\{beamInfoItems\}/);
  assert.match(source, /const beamInfoItems = useMemo\(\(\) => \{/);
  assert.match(source, /if \(item\.displayOnly === true\) continue;/);
  assert.match(source, /!multiCandidateCentralOverlayActive[\s\S]{0,180}HandoverLinks/);
  assert.match(
    source,
    /presentationPlan\.visible\['serving-beams'\][\s\S]{0,420}!multiCandidateSceneVisualActive[\s\S]{0,420}<SinrLiveCellBeamCones/,
    'the established serving cone remains mounted outside the bounded comparison layer',
  );
  // The established pulse/cross-fade carriers remain mounted. Candidate
  // authority may replace only their role hue with stable satellite/beam
  // identity; it must not erase the animation.
  assert.doesNotMatch(source, /multiCandidateAuthorityActive \? \[\] : sinrLiveCellPulseConeItems/);
  assert.doesNotMatch(source, /multiCandidateAuthorityActive \? \[\] : triggeredIntraConeItems/);
  assert.doesNotMatch(source, /multiCandidateAuthorityActive \? \[\] : sinrLiveCinemaHandoverPairConeItems/);
  assert.match(
    source,
    /const additiveHandoverPulseConeItems = useMemo\([\s\S]{0,900}sinrLiveCellPulseConeItems[\s\S]{0,900}filtered\.map\(item => \(\{/,
  );
  assert.match(
    source,
    /acceptedHandoverPresentation\?\.commit,[\s\S]{0,120}handoverPresentation\.event/,
  );
  assert.match(source, /triggeredIntraConeItems\.map\(item => \(\{/);
  assert.match(source, /sinrLiveCinemaHandoverPairConeItems\.map\(item => \(\{/);
  assert.match(
    source,
    /items=\{additiveHandoverPulseConeItems\}[\s\S]{0,240}colorAuthority="item-identity"/,
  );
  assert.match(
    source,
    /items=\{additiveTriggeredIntraConeItems\}[\s\S]{0,520}colorAuthority="item-identity"/,
  );
  assert.match(
    source,
    /items=\{authorityHandoverPairConeItems\}[\s\S]{0,180}colorAuthority="item-identity"/,
  );
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
  assert.match(
    authorityPairBlock,
    /multiCandidateCentralOverlayActive \|\| multiCandidateIdentityTransitionActive/,
    'the established source/target cone remains visible while the comparison layer parks during switching',
  );
  assert.match(authorityPairBlock, /authorityPresentationCommitObserved[\s\S]{0,160}toSatId[\s\S]{0,160}fromSatId/);
  assert.match(
    source,
    /telemetryCountDatasetKey="multiCandidateAuthorityTransitionConeRenderedCount"/,
  );
  assert.match(source, /<DecisionHandoverCue/);
  assert.match(source, /identityColorBySatelliteBeamId=\{liveBeamIdentityColorBySatelliteBeam\}/);
  assert.match(
    source,
    /const multiCandidateBeamColorBySatelliteBeam = useMemo\(\(\) => \{[\s\S]{0,420}instruction\.beamId/,
  );
  assert.match(
    source,
    /identityColorBySatelliteBeamId=\{liveBeamIdentityColorBySatelliteBeam\}/,
  );
  assert.match(source, /HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR/);
  assert.match(source, /const latchedAuthorityTransition = useMemo/);
  const latchedTransitionBlock = source.slice(
    source.indexOf('const latchedAuthorityTransition = useMemo'),
    source.indexOf('const additiveHandoverPulseConeItems = useMemo'),
  );
  assert.match(
    latchedTransitionBlock,
    /multiCandidateCentralOverlayActive \|\| multiCandidateIdentityTransitionActive/,
    'the transition cue remains joined to the accepted identity during switching',
  );
  assert.match(source, /progress01=\{handoverPresentation\.progress01\}/);
  assert.match(
    source,
    /const multiCandidateIdentityTransitionActive = multiCandidateAuthorityActive[\s\S]{0,180}authorityTransition\.eventId/,
  );
  assert.match(source, /multiCandidateCentralOverlayActive \|\| multiCandidateIdentityTransitionActive/);
  assert.match(
    source,
    /const authorityHandoverPresentationCandidate = useMemo\([\s\S]{0,120}\) => multiCandidateAuthorityActive/,
  );
  assert.match(source, /const authorityTransitionRef = useRef<AuthorityHandoverTransition \| null>\(null\)/);
  assert.doesNotMatch(
    source,
    /showLiveSceneEffects[\s\S]{0,100}!multiCandidateAuthorityActive[\s\S]{0,180}<IntraGroundShockwave/,
  );
  // The event callout is part of the established carrier and remains visible
  // while candidate comparison is layered on top; authority must not blank it.
  assert.doesNotMatch(source, /showHandoverToastOverlay[\s\S]{0,80}!multiCandidateCentralOverlayActive/);
  assert.doesNotMatch(
    source,
    /authorityHandoverPairConeItems[\s\S]{0,420}handoverAuthorityJoin\?\.showTransitionCue !== true/,
  );
});

test('central comparison is rendered from the accepted pre-selection projection', () => {
  // The established carrier stays mounted, while the accepted snapshot's
  // candidate projection is now visible during the real pre-selection phase.
  assert.match(source, /const MULTI_CANDIDATE_CENTRAL_OVERLAY_ENABLED = true/);
  assert.match(source, /The accepted candidate plan is a real scene projection/);
  assert.match(
    source,
    /const acceptedHandoverDecisionFrame = acceptedHandoverPresentation\?\.decision \?\? null;[\s\S]{0,220}const multiCandidateSnapshotMatchesFrame = acceptedHandoverSnapshotTracksDecisionFrame\(\s*acceptedHandoverPresentation,\s*acceptedHandoverDecisionFrame,\s*\)/,
    'the render gate must validate the App-owned snapshot, not compare it with the continuously advancing raw render tick',
  );
  assert.match(source, /const multiCandidateAuthorityActive = multiCandidateSnapshotMatchesFrame/);
  assert.match(
    source,
    /const rawMultiCandidateComparisonPhase = acceptedComparisonDecision !== null[\s\S]{0,220}isMultiCandidateComparisonFocusDecisionFrame\(acceptedComparisonDecision\)[\s\S]{0,2200}const multiCandidateComparisonPhase = rawMultiCandidateComparisonPhase[\s\S]{0,180}const multiCandidateCentralOverlayActive = multiCandidateAuthorityActive[\s\S]{0,180}multiCandidateComparisonPhase/,
  );
  assert.match(
    source,
    /const candidateComparisonSceneActive = multiCandidateAuthorityActive[\s\S]{0,180}multiCandidateComparisonPhase[\s\S]{0,180}multiCandidateCandidateReviewPresentation !== null/,
    'the central candidate state must follow the accepted pre-selection phase',
  );
  assert.doesNotMatch(
    source,
    /MULTI_CANDIDATE_CENTRAL_REVIEW_SEC|resolveMultiCandidateComparisonReviewWindowActive\(/,
    'candidate visibility must not be driven by a second wall-clock review timer',
  );
  assert.match(
    source,
    /showLiveSceneEffects[\s\S]*?HandoverLinks/,
  );
  const markerBlock = source.slice(
    source.indexOf('const handoverMarkerSatelliteIds'),
    source.indexOf('// Camera ownership is deliberately absent from the comparison projection.'),
  );
  assert.match(
    markerBlock,
    /const markers:[\s\S]{0,180}= viz\.displaySats\.map\(marker => \{/,
    'every ambient marker is projected through a stable satellite identity colour',
  );
  assert.match(
    markerBlock,
    /colorForServingSatellite\(marker\.id\)\.markerColor/,
    'markers fall back to the same identity resolver outside an accepted comparison episode',
  );
  assert.match(markerBlock, /satelliteTintColor: identityColor/);
  assert.match(markerBlock, /handoverCinemaCandidate\.fromSatId/);
  assert.match(markerBlock, /handoverCinemaCandidate\.toSatId/);
  assert.match(markerBlock, /transition\.from\.satelliteId/);
  assert.match(markerBlock, /transition\.to\.satelliteId/);
  assert.match(
    source,
    /eventRole=\{multiCandidateSceneVisualActive \? undefined : viz\.eventRoles\.get\(sat\.id\)\}/,
  );
  assert.match(source, /multiCandidateScenePresentation = useMemo\([\s\S]{0,220}!MULTI_CANDIDATE_CENTRAL_OVERLAY_ENABLED/);
  assert.match(source, /isMultiCandidateComparisonFocusDecisionFrame/);
  assert.match(source, /const MULTI_CANDIDATE_CENTRAL_OVERLAY_ENABLED = true/);
  assert.match(
    source,
    /const centralMarkerSourcePlan = candidateComparisonSceneActive\s*\n\s*\? multiCandidateCandidateReviewRenderPlan/,
    'the compact review beat must filter ambient GLBs to the same shortlist shown by the rail',
  );
  assert.match(
    source,
    /renderSatelliteIdentityLabels=\{false\}/,
    'candidate identity text must be owned by the GLB marker, not a detached centre badge',
  );
});

test('identity colours follow satellite hue and beam shade through intra-handover effects', () => {
  const satelliteColors = new Map([['sat-a', '#cc6677']]);
  const beamColors = new Map([
    ['sat-a/2', '#b95566'],
    ['sat-a/5', '#df8290'],
  ]);
  const colors = resolveIntraGroundShockwaveColors({
    event: { satId: 'sat-a', fromBeamId: 2, toBeamId: 5 },
    identityColorBySatelliteId: satelliteColors,
    identityColorBySatelliteBeamId: beamColors,
  });
  assert.deepEqual(colors, { sourceColor: '#b95566', targetColor: '#df8290' });
  assert.notEqual(colors.sourceColor, colors.targetColor);

  const servingBeam: BeamTarget = {
    beamId: 5,
    groundX: 0,
    groundZ: 0,
    isServing: true,
    isScheduledActive: true,
    isPrimary: true,
    showBeam: true,
    frequencyIndex: 0,
    satelliteTintColor: '#cc6677',
    satelliteGlyph: 'circle',
    satelliteVisualIndex: 0,
  };
  const ripple = resolveGroundRippleTargets({
    satBeams: new Map([['sat-a', [servingBeam]]]),
    footprintRadius: 10,
    identityColorBySatelliteId: satelliteColors,
    identityColorBySatelliteBeamId: beamColors,
  });
  assert.equal(ripple[0]?.color, '#df8290');
});

test('homepage candidate cones cannot fall back to the legacy pending-target stream', () => {
  const candidateBlockStart = source.indexOf('const sinrLiveCandidateBeamConeItems');
  const candidateBlockEnd = source.indexOf('const sinrLiveCinemaInterServingFanConeItems', candidateBlockStart);
  assert.ok(candidateBlockStart >= 0 && candidateBlockEnd > candidateBlockStart);
  const candidateBlock = source.slice(candidateBlockStart, candidateBlockEnd);
  assert.match(
    candidateBlock,
    /if \(homepageVisualIdentity\) \{[\s\S]{0,900}return \[\];/,
    'homepage candidate geometry must come from accepted SceneProjection/pair ownership, not legacy pendingTargetSatId',
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
    /multiCandidateSceneGlobalSolidDataLinkCount=\{String\(\s*multiCandidateSceneRenderPlan\?\.solidDataLinkCount[\s\S]{0,180}acceptedHandoverPresentation\?\.activeDataLinkCount[\s\S]{0,80}\)\}/,
  );
  assert.match(source, /multiCandidateSceneRenderStatus=\{multiCandidateSceneRenderStatus\}/);
  assert.match(
    source,
    /multiCandidateCarrierFallbackActive=\{\s*multiCandidateCentralOverlayActive && !multiCandidateServingCarrierRenderable \? '1' : '0'\s*\}/,
  );
  assert.match(source, /multiCandidateEventCueCount=\{String\(multiCandidateEventCueCount\)\}/);
  assert.match(source, /presentationPlan\.visible\['serving-beams'\][\s\S]{0,160}<SinrLiveCellBeamCones/);
});

test('multi-candidate comparison does not take ownership of the homepage camera', () => {
  // The comparison projection no longer contains an auto-fit effect at all.
  // This is stronger than a runtime false flag: candidate updates cannot
  // accidentally regain camera ownership by flipping a constant.
  assert.doesNotMatch(source, /MULTI_CANDIDATE_AUTO_CAMERA_REFIT_ENABLED/);
  assert.doesNotMatch(source, /resolveMultiCandidateCameraFit/);
  assert.doesNotMatch(source, /areMultiCandidateFocusPointsWithinSafeFrame/);
  assert.doesNotMatch(source, /multiCandidateCameraRecoveryEpisodeRef/);
  assert.match(source, /Camera ownership is deliberately absent from the comparison projection/);
  assert.doesNotMatch(source, /multiCandidateCameraFitKeyRef/);
  assert.doesNotMatch(source, /multiCandidateCameraEpisodeRef/);
  assert.doesNotMatch(source, /multiCandidateCameraUserControlledRef/);
  assert.match(source, /const MULTI_CANDIDATE_SATELLITE_SCALE_MULTIPLIER = 7/);
  assert.match(
    source,
    /scaleMultiplier=\{multiCandidateSceneVisualActive\s*\? MULTI_CANDIDATE_SATELLITE_SCALE_MULTIPLIER\s*:\s*1\}/,
  );
});

test('the paused producer keeps the established always-on render loop', () => {
  assert.match(
    source,
    /frameloop=\{sceneLane === 'modqn-replay-proof' \? 'demand' : 'always'\}/,
  );
});

test('scene and right rail consume the exact same accepted plan without rebuilding it', () => {
  assert.doesNotMatch(source, /useHomepageCandidatePresentationPlan/);
  assert.doesNotMatch(railSource, /useHomepageCandidatePresentationPlan/);
  assert.doesNotMatch(railSource, /buildCandidatePresentationPlan/);
  assert.match(railSource, /const plan = snapshot\.plan/);
  assert.match(infoPanelSource, /<HandoverEvaluationPanel snapshot=\{acceptedHandoverPresentation\}/);
  assert.match(appSource, /acceptedHandoverPresentation=\{isWalkerSceneActive[\s\S]{0,160}simState\.acceptedHandoverPresentation/);
  assert.match(
    source,
    /data-accepted-handover-snapshot-id=\{acceptedHandoverPresentation\?\.snapshotId \?\? ''\}/,
  );
  assert.match(source, /acceptedHandoverPresentation: AcceptedHandoverPresentationSnapshot \| null/);
  assert.doesNotMatch(source, /const acceptedHandoverPresentationSession = useSimStatePublisher/);
  assert.match(publisherSource, /acceptedHandoverPresentation:\s*acceptedHandoverPresentationSnapshotForRender/);
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
    /const naturalCandidate = \(multiCandidateAuthorityOwnsLifecycle[\s\S]{0,180}\?\s*null/,
  );
  // Must NOT blanket early-return authorityHandoverPresentationCandidate when null
  assert.doesNotMatch(
    source,
    /if \(multiCandidateAuthorityActive\) return authorityHandoverPresentationCandidate;/,
  );
});

test('homepage cinema pair render gate admits indexed intra handover', () => {
  const pairBlock = source.slice(
    source.indexOf('const sinrLiveCinemaHandoverPairConeItems = useMemo'),
    source.indexOf('const authorityHandoverPairConeItems = useMemo'),
  );
  assert.match(pairBlock, /presentedInterHandoverActive[\s\S]{0,180}presentedCinemaHandoverActive[\s\S]{0,180}kind === 'intra'/);
  assert.match(pairBlock, /resolveCinemaHandoverPairConeItems\(\{/);
});
