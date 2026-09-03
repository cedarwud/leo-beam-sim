import assert from 'node:assert/strict';
import test from 'node:test';

import { candidateLinkKey } from '../engine/handover/candidateDecisionContract';
import {
  resolveHandoverEventCuePolicy,
  type HandoverEventCueLifecyclePhase,
  type HandoverEventCuePolicyInput,
} from './handoverEventCuePolicy';
import type { AuthorityHandoverTransition } from './handoverAuthorityJoin';
import type { HandoverPresentationView } from './handoverPresentationOwner';

const intraFrom = candidateLinkKey('sat-a', 2);
const intraTo = candidateLinkKey('sat-a', 5);
const interFrom = candidateLinkKey('sat-a', 2);
const interTo = candidateLinkKey('sat-b', 2);

function transition(
  kind: 'intra' | 'inter',
  from = kind === 'intra' ? intraFrom : interFrom,
  to = kind === 'intra' ? intraTo : interTo,
  boundary: AuthorityHandoverTransition['boundary'] = 'selected',
): AuthorityHandoverTransition {
  return {
    eventId: `${kind}-event-1`,
    episodeId: 'episode-1',
    sourceFrameId: 'frame-1',
    simTimeMs: 1_000,
    kind,
    boundary,
    from,
    to,
  };
}

function presentationView(
  accepted: AuthorityHandoverTransition,
): Pick<HandoverPresentationView, 'active' | 'event'> {
  return {
    active: true,
    event: {
      eventId: accepted.eventId,
      source: 'walker',
      kind: accepted.kind,
      from: {
        satId: accepted.from.satelliteId,
        cellId: 1,
        beamId: accepted.from.beamId,
        drawable: true,
      },
      to: {
        satId: accepted.to.satelliteId,
        cellId: 4,
        beamId: accepted.to.beamId,
        drawable: true,
      },
      durationMs: accepted.kind === 'intra' ? 8_000 : 6_000,
    },
  };
}

function inputFor(
  accepted: AuthorityHandoverTransition,
  phase: HandoverEventCuePolicyInput['phase'],
): HandoverEventCuePolicyInput {
  return {
    transition: accepted,
    phase,
    presentationOwner: 'natural',
    presentationView: presentationView(accepted),
  };
}

test('keeps one exact intra pair drawable through the decision lifecycle', () => {
  const accepted = transition('intra');
  const phases: readonly [HandoverEventCuePolicyInput['phase'], HandoverEventCueLifecyclePhase][] = [
    ['evaluating', 'preselection'],
    ['qualifying', 'ttt'],
    ['selection-hold', 'selection-hold'],
    ['switching', 'switching'],
    ['guard', 'commit-continuation'],
  ];

  for (const [phase, lifecyclePhase] of phases) {
    const policy = resolveHandoverEventCuePolicy({
      ...inputFor(accepted, phase),
      transition: phase === 'guard' ? { ...accepted, boundary: 'committed' } : accepted,
    });
    assert.equal(policy.drawable, true, `${phase} admits the intra cue`);
    assert.equal(policy.lifecyclePhase, lifecyclePhase);
    assert.equal(policy.transition?.from, accepted.from);
    assert.equal(policy.transition?.to, accepted.to);
  }
});

test('keeps the exact inter pair and owner during switching and commit continuation', () => {
  const selected = transition('inter');
  const switching = resolveHandoverEventCuePolicy(inputFor(selected, 'switching'));
  assert.equal(switching.drawable, true);
  assert.equal(switching.transition?.kind, 'inter');
  assert.deepEqual(switching.transition && {
    from: switching.transition.from,
    to: switching.transition.to,
  }, { from: interFrom, to: interTo });
  assert.equal(switching.presentationOwner, 'natural');

  const committed = { ...selected, boundary: 'committed' as const };
  const continuation = resolveHandoverEventCuePolicy({
    ...inputFor(committed, 'guard'),
    transition: committed,
  });
  assert.equal(continuation.drawable, true);
  assert.equal(continuation.lifecyclePhase, 'commit-continuation');
  assert.equal(continuation.transition?.eventId, selected.eventId);
  assert.deepEqual(continuation.transition?.from, selected.from);
  assert.deepEqual(continuation.transition?.to, selected.to);
});

test('fails closed for missing or mismatched authority/presentation identity', () => {
  const accepted = transition('inter');
  const base = inputFor(accepted, 'switching');

  for (const input of [
    { ...base, transition: null },
    { ...base, presentationOwner: null },
    { ...base, presentationView: { ...base.presentationView!, active: false } },
    {
      ...base,
      presentationView: {
        ...base.presentationView!,
        event: { ...base.presentationView!.event!, eventId: 'foreign-event' },
      },
    },
    {
      ...base,
      presentationView: {
        ...base.presentationView!,
        event: {
          ...base.presentationView!.event!,
          to: { ...base.presentationView!.event!.to, beamId: interTo.beamId + 1 },
        },
      },
    },
    {
      ...base,
      phase: 'guard' as const,
    },
  ]) {
    assert.equal(resolveHandoverEventCuePolicy(input).drawable, false);
    assert.equal(resolveHandoverEventCuePolicy(input).transition, null);
  }
});
