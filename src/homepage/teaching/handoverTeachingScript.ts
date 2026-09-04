/**
 * Scripted teaching data for the two homepage handover lectures.
 *
 * WHY THIS IS SEPARATE FROM THE LIVE LANE. The live Walker scenario currently
 * keeps the primary UE's serving link both above the EE floor and above every
 * replacement, so it never satisfies the homepage's handover rule and produces
 * no event to narrate. Rather than teach from a scenario that cannot reach the
 * decision, this module authors the decision outright: one deterministic
 * timeline per handover kind, paced for a lecturer.
 *
 * CLAIM BOUNDARY. Every number here is authored for teaching. It is not
 * measured, not canonical EE, and not produced by the handover engine. The
 * stage that renders it must say so on screen. What it *is* faithful to is the
 * homepage's actual decision rule, so the lecture matches the product:
 *
 *   1. the replacement must itself clear the EE floor;
 *   2. the serving link must have fallen BELOW the floor;
 *   3. the replacement must beat the serving link;
 *   4. that must hold continuously for the time-to-trigger.
 *
 * Both lectures always reach a commit. The trajectories are written so the
 * conditions turn true in rule order and stay true; neither run is designed to
 * stall on a refusal.
 */

export type TeachingHandoverKind = 'intra' | 'inter';

export type TeachingPhaseId =
  | 'serving'
  | 'candidate'
  | 'countdown'
  | 'switching'
  | 'settled';

/** The EE floor both lectures are written around, in Kbit/J. */
export const TEACHING_EE_THRESHOLD_KBIT_PER_JOULE = 135;

/** Fixed rail scale, so a bar length means the same thing in both lectures. */
export const TEACHING_EE_SCALE_MIN_KBIT_PER_JOULE = 80;
export const TEACHING_EE_SCALE_MAX_KBIT_PER_JOULE = 200;

/**
 * Time-to-trigger per kind, in seconds — the real profile values.
 *
 * The contrast is the lesson: a same-satellite beam change is cheap and needs
 * only a short dwell, while changing spacecraft is expensive and must prove
 * itself for far longer.
 */
export const TEACHING_TTT_SEC: Readonly<Record<TeachingHandoverKind, number>> = Object.freeze({
  intra: 0.75,
  inter: 3.5,
});

export interface TeachingPhase {
  readonly id: TeachingPhaseId;
  /** Index of the five-step rail chip this phase lights, 0-4. */
  readonly stepIndex: number;
  readonly durationSec: number;
  readonly titleZhHant: string;
  readonly titleEn: string;
  readonly narrationZhHant: string;
  readonly narrationEn: string;
  /**
   * Neutral label for the event this phase represents. Teaching-aid text: it
   * states what the decision state is, and is not addressed to a reader.
   */
  readonly eventLabelZhHant: string;
  readonly eventLabelEn: string;
}

export interface TeachingLink {
  readonly id: string;
  readonly satelliteLabel: string;
  readonly beamLabel: string;
  readonly color: string;
  /** EE in Kbit/J at each phase boundary, one entry per phase plus the end. */
  readonly eeKeyframes: readonly number[];
  readonly role: 'serving' | 'winner' | 'alternative';
  /** Elevation in degrees at each phase boundary; supporting geometry evidence. */
  readonly elevationKeyframes: readonly number[];
}

export interface TeachingScript {
  readonly kind: TeachingHandoverKind;
  readonly titleZhHant: string;
  readonly titleEn: string;
  readonly phases: readonly TeachingPhase[];
  readonly links: readonly TeachingLink[];
  readonly tttSec: number;
  /** Handover cost shown on the receipt, authored to match the kind. */
  readonly receipt: {
    readonly interruptionMs: number;
    readonly signallingMessages: number;
    readonly costNoteZhHant: string;
    readonly costNoteEn: string;
  };
}

const SERVING_COLOR = '#facc15';
const WINNER_COLOR = '#5fe3ff';
const INTRA_WINNER_COLOR = '#ffa24d';
const ALT_COLOR = '#8397d1';

/**
 * Shared beat structure. Both lectures answer the same four questions in the
 * same order so the two runs can be compared; only the durations, the roster,
 * and the wording of the switch itself differ.
 */
function phasesFor(kind: TeachingHandoverKind): readonly TeachingPhase[] {
  const sameSatellite = kind === 'intra';
  return Object.freeze([
    Object.freeze({
      id: 'serving' as const,
      stepIndex: 0,
      durationSec: 12,
      titleZhHant: '服務中',
      titleEn: 'In service',
      eventLabelZhHant: '決策狀態：監測',
      eventLabelEn: 'Decision state: monitoring',
      narrationZhHant: '服務鏈路 EE 高於閾值，維持監測。',
      narrationEn: 'Serving EE is above the floor. Monitoring.',
    }),
    Object.freeze({
      id: 'candidate' as const,
      stepIndex: 1,
      durationSec: 16,
      titleZhHant: sameSatellite ? '相鄰波束效率上升' : '替代鏈路出現',
      titleEn: sameSatellite ? 'Adjacent beam efficiency rises' : 'Replacement link appears',
      eventLabelZhHant: sameSatellite
        ? '條件①：候選波束達到閾值'
        : '條件①：候選衛星達到閾值',
      eventLabelEn: sameSatellite
        ? 'Condition 1: candidate beam clears the floor'
        : 'Condition 1: candidate satellite clears the floor',
      narrationZhHant: sameSatellite
        ? '服務 EE 下降；同衛星相鄰波束 EE 上升並跨越閾值，成為候選。'
        : '服務 EE 下降；替代衛星 EE 上升並跨越閾值，成為候選。',
      narrationEn: sameSatellite
        ? 'Serving EE falls. An adjacent beam on the same satellite rises past the floor and becomes a candidate.'
        : 'Serving EE falls. A replacement satellite rises past the floor and becomes a candidate.',
    }),
    Object.freeze({
      id: 'countdown' as const,
      stepIndex: 2,
      durationSec: 18,
      titleZhHant: '觸發時間累計',
      titleEn: 'Trigger time accumulating',
      eventLabelZhHant: '四項條件成立 · TTT 計時中',
      eventLabelEn: 'All conditions met · TTT running',
      narrationZhHant: sameSatellite
        ? '服務 EE 跌破閾值，四項條件成立，計時 0.75 秒。'
        : '服務 EE 跌破閾值，四項條件成立，計時 3.5 秒。',
      narrationEn: sameSatellite
        ? 'Serving EE is below the floor. All four conditions hold; timing 0.75 s.'
        : 'Serving EE is below the floor. All four conditions hold; timing 3.5 s.',
    }),
    Object.freeze({
      id: 'switching' as const,
      stepIndex: 3,
      durationSec: 12,
      titleZhHant: sameSatellite ? '波束重指向' : '跨衛星轉移',
      titleEn: sameSatellite ? 'Beam re-pointing' : 'Inter-satellite transfer',
      eventLabelZhHant: '執行換手',
      eventLabelEn: 'Handover executing',
      narrationZhHant: sameSatellite
        ? '服務由原波束重指向至目標波束，衛星不變，不需重建連線。'
        : '服務由原衛星轉移至目標衛星，連線需重建。',
      narrationEn: sameSatellite
        ? 'Service re-points to the target beam. Same satellite, no link re-establishment.'
        : 'Service transfers to the target satellite. The link is re-established.',
    }),
    Object.freeze({
      id: 'settled' as const,
      stepIndex: 4,
      durationSec: 14,
      titleZhHant: '狀態回穩',
      titleEn: 'Steady state restored',
      eventLabelZhHant: '決策狀態：監測',
      eventLabelEn: 'Decision state: monitoring',
      narrationZhHant: '換手完成。新服務鏈路 EE 高於閾值，回到監測。',
      narrationEn: 'Handover complete. New serving EE is above the floor; monitoring resumes.',
    }),
  ]);
}

/**
 * Rosters. The EE keyframes are the lecture: seven values per link, one per
 * phase boundary, chosen so the four conditions flip in the intended order and
 * only in that order.
 *
 *          serving  candidate  blocked  countdown  switching  settled  end
 *  floor = 135 throughout.
 */
function linksFor(kind: TeachingHandoverKind): readonly TeachingLink[] {
  if (kind === 'intra') {
    return Object.freeze([
      Object.freeze({
        id: 'serving',
        satelliteLabel: 'G42-17-05',
        beamLabel: 'B1',
        color: SERVING_COLOR,
        role: 'serving' as const,
        //         start  cand   count  switch  settled  end
        eeKeyframes: Object.freeze([178, 168, 142, 124, 121, 119]),
        elevationKeyframes: Object.freeze([71, 66, 58, 51, 48, 46]),
      }),
      Object.freeze({
        id: 'winner',
        satelliteLabel: 'G42-17-05',
        beamLabel: 'B3',
        color: INTRA_WINNER_COLOR,
        role: 'winner' as const,
        eeKeyframes: Object.freeze([118, 148, 166, 171, 172, 172]),
        elevationKeyframes: Object.freeze([71, 66, 58, 51, 48, 46]),
      }),
      Object.freeze({
        id: 'alt-a',
        satelliteLabel: 'G42-17-05',
        beamLabel: 'B5',
        color: ALT_COLOR,
        role: 'alternative' as const,
        eeKeyframes: Object.freeze([104, 116, 127, 131, 130, 129]),
        elevationKeyframes: Object.freeze([71, 66, 58, 51, 48, 46]),
      }),
      Object.freeze({
        id: 'alt-b',
        satelliteLabel: 'G42-17-05',
        beamLabel: 'B6',
        color: ALT_COLOR,
        role: 'alternative' as const,
        eeKeyframes: Object.freeze([96, 104, 112, 116, 115, 114]),
        elevationKeyframes: Object.freeze([71, 66, 58, 51, 48, 46]),
      }),
    ]);
  }
  return Object.freeze([
    Object.freeze({
      id: 'serving',
      satelliteLabel: 'G42-17-05',
      beamLabel: 'B1',
      color: SERVING_COLOR,
      role: 'serving' as const,
      eeKeyframes: Object.freeze([176, 166, 140, 123, 119, 117]),
      elevationKeyframes: Object.freeze([64, 54, 42, 32, 27, 24]),
    }),
    Object.freeze({
      id: 'winner',
      satelliteLabel: 'G53-24-02',
      beamLabel: 'B1',
      color: WINNER_COLOR,
      role: 'winner' as const,
      eeKeyframes: Object.freeze([112, 150, 170, 176, 177, 177]),
      elevationKeyframes: Object.freeze([21, 38, 54, 64, 68, 70]),
    }),
    Object.freeze({
      id: 'alt-a',
      satelliteLabel: 'G51-08-11',
      beamLabel: 'B1',
      color: ALT_COLOR,
      role: 'alternative' as const,
      eeKeyframes: Object.freeze([108, 120, 129, 132, 131, 129]),
      elevationKeyframes: Object.freeze([28, 34, 39, 41, 40, 38]),
    }),
    Object.freeze({
      id: 'alt-b',
      satelliteLabel: 'G47-31-04',
      beamLabel: 'B1',
      color: ALT_COLOR,
      role: 'alternative' as const,
      eeKeyframes: Object.freeze([94, 102, 110, 113, 112, 110]),
      elevationKeyframes: Object.freeze([17, 22, 26, 29, 28, 27]),
    }),
  ]);
}

export function buildHandoverTeachingScript(kind: TeachingHandoverKind): TeachingScript {
  return Object.freeze({
    kind,
    titleZhHant: kind === 'intra' ? '同衛星波束換手' : '跨衛星換手',
    titleEn: kind === 'intra' ? 'Same-satellite beam handover' : 'Inter-satellite handover',
    phases: phasesFor(kind),
    links: linksFor(kind),
    tttSec: TEACHING_TTT_SEC[kind],
    receipt: kind === 'intra'
      ? Object.freeze({
        interruptionMs: 12,
        signallingMessages: 2,
        costNoteZhHant: '服務衛星不變，無須重建連線，成本量級低。',
        costNoteEn: 'No spacecraft change and no link re-establishment; low-magnitude cost.',
      })
      : Object.freeze({
        interruptionMs: 47,
        signallingMessages: 9,
        costNoteZhHant: '服務衛星改變，連線須重建，成本顯著較高。',
        costNoteEn: 'The spacecraft changed and the link is re-established; markedly higher cost.',
      }),
  });
}

/**
 * EE → 0..1 strength on the lecture's own scale.
 *
 * The rail sizes its bars with this and the scene fades its cones with it, so
 * a link that reads strong in one surface cannot read weak in the other.
 */
export function teachingEeRatio01(kbitPerJoule: number): number {
  const span = TEACHING_EE_SCALE_MAX_KBIT_PER_JOULE - TEACHING_EE_SCALE_MIN_KBIT_PER_JOULE;
  return Math.max(0, Math.min(1, (kbitPerJoule - TEACHING_EE_SCALE_MIN_KBIT_PER_JOULE) / span));
}

export function teachingScriptTotalSec(script: TeachingScript): number {
  return script.phases.reduce((total, phase) => total + phase.durationSec, 0);
}

export interface TeachingFrame {
  readonly phase: TeachingPhase;
  readonly phaseIndex: number;
  /** Progress through the current phase, 0-1. */
  readonly phaseProgress01: number;
  readonly elapsedSec: number;
  readonly totalSec: number;
  readonly links: readonly TeachingLinkFrame[];
  readonly serving: TeachingLinkFrame;
  readonly winner: TeachingLinkFrame;
  /** Seconds accumulated toward the time-to-trigger; 0 before the floor break. */
  readonly tttElapsedSec: number;
  readonly tttSec: number;
  /** True once serving EE is under the floor — the rule's second condition. */
  readonly servingBelowThreshold: boolean;
  /** True once the replacement leads, whether or not it is allowed to win yet. */
  readonly replacementLeads: boolean;
  /** True only while a better replacement is being deliberately refused. */
  readonly blockedByThreshold: boolean;
  readonly committed: boolean;
  /** 0-1 across the switching beat, for the transfer animation. */
  readonly switchProgress01: number;
}

/**
 * The live scene's identities. The lecture's numbers are authored, but the
 * spacecraft and beams they are attached to must be the ones the viewer can
 * actually see moving in the scene, or the rail is describing a different sky.
 */
export interface TeachingLinkIdentity {
  /** Display name exactly as the scene and the live rail render it. */
  readonly satelliteLabel: string;
  readonly beamLabel: string;
  /**
   * Real elevation from the scene, when the live frame supplies one. The
   * lecture authors energy efficiency, never geometry: a scripted elevation
   * that disagrees with the spacecraft on screen makes the narration, the rail,
   * and the scene tell three different stories.
   */
  readonly elevationDeg?: number | null;
}

export interface TeachingIdentityBinding {
  readonly serving: TeachingLinkIdentity | null;
  /** Replacement rows in the order the live rail ranks them. */
  readonly candidates: readonly TeachingLinkIdentity[];
}

export interface TeachingLinkFrame extends TeachingLink {
  readonly eeKbitPerJoule: number;
  readonly elevationDeg: number;
  /** True once this link is the one in service at this instant. */
  readonly isServing: boolean;
  /** Clears the EE floor, so it is a legal replacement (condition one). */
  readonly eligible: boolean;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function sampleKeyframes(
  keyframes: readonly number[],
  phaseIndex: number,
  phaseProgress01: number,
): number {
  const from = keyframes[phaseIndex] ?? keyframes[keyframes.length - 1] ?? 0;
  const to = keyframes[phaseIndex + 1] ?? from;
  return lerp(from, to, phaseProgress01);
}

/**
 * Resolve one frame of the lecture at `elapsedSec`.
 *
 * Pure, so the stage can be scrubbed, paused, and unit-tested without a clock.
 */
export function resolveTeachingFrame(
  script: TeachingScript,
  elapsedSec: number,
  binding: TeachingIdentityBinding | null = null,
): TeachingFrame {
  const totalSec = teachingScriptTotalSec(script);
  const clampedSec = Math.max(0, Math.min(totalSec, Number.isFinite(elapsedSec) ? elapsedSec : 0));

  let phaseIndex = 0;
  let phaseStartSec = 0;
  for (let index = 0; index < script.phases.length; index += 1) {
    const phase = script.phases[index]!;
    if (clampedSec < phaseStartSec + phase.durationSec || index === script.phases.length - 1) {
      phaseIndex = index;
      break;
    }
    phaseStartSec += phase.durationSec;
  }
  const phase = script.phases[phaseIndex]!;
  const phaseProgress01 = Math.max(0, Math.min(1, (clampedSec - phaseStartSec) / phase.durationSec));

  const committed = phase.id === 'settled'
    || (phase.id === 'switching' && phaseProgress01 >= 0.5);
  const switchProgress01 = phase.id === 'switching'
    ? phaseProgress01
    : phase.id === 'settled' ? 1 : 0;

  const thresholdKbitPerJoule = TEACHING_EE_THRESHOLD_KBIT_PER_JOULE;
  // Bind the authored roster onto whatever the scene is actually showing. A
  // missing live identity falls back to the script's own label rather than
  // rendering a blank row.
  const liveServing = binding?.serving ?? null;
  const liveCandidates = binding?.candidates ?? [];
  let candidateCursor = 0;
  const links = script.links.map((link): TeachingLinkFrame => {
    const eeKbitPerJoule = sampleKeyframes(link.eeKeyframes, phaseIndex, phaseProgress01);
    // Intra keeps every row on the serving spacecraft and varies only the beam;
    // inter takes each replacement row from the live roster in rank order. A
    // missing live identity keeps the script's own label rather than blanking.
    const liveIdentity = link.role === 'serving'
      ? liveServing
      : script.kind === 'intra'
        ? (liveCandidates[candidateCursor++] ?? null)
        : (liveCandidates[candidateCursor++] ?? null);
    const satelliteLabel = script.kind === 'intra'
      ? liveServing?.satelliteLabel ?? link.satelliteLabel
      : liveIdentity?.satelliteLabel ?? link.satelliteLabel;
    const beamLabel = liveIdentity?.beamLabel ?? link.beamLabel;
    return {
      ...link,
      satelliteLabel,
      beamLabel,
      eeKbitPerJoule,
      elevationDeg: typeof liveIdentity?.elevationDeg === 'number'
        && Number.isFinite(liveIdentity.elevationDeg)
        ? liveIdentity.elevationDeg
        : sampleKeyframes(link.elevationKeyframes, phaseIndex, phaseProgress01),
      // After the commit the winner is the link in service; before it, the
      // original serving link still is. Nothing else is ever "serving".
      isServing: committed ? link.role === 'winner' : link.role === 'serving',
      eligible: eeKbitPerJoule >= thresholdKbitPerJoule,
    };
  });

  const serving = links.find(link => link.role === 'serving')!;
  // A replacement row the live scene cannot name would put a spacecraft in the
  // rail that the viewer cannot find in the scene, so drop it instead.
  const namedLinks = script.kind === 'inter'
    ? links.filter((link, index) => link.role === 'serving'
      || index - 1 < liveCandidates.length)
    : links;
  const winner = links.find(link => link.role === 'winner')!;
  const servingBelowThreshold = serving.eeKbitPerJoule < thresholdKbitPerJoule;
  const replacementLeads = winner.eeKbitPerJoule > serving.eeKbitPerJoule;

  const countdownIndex = script.phases.findIndex(candidate => candidate.id === 'countdown');
  const tttElapsedSec = phaseIndex < countdownIndex
    ? 0
    : phaseIndex > countdownIndex
      ? script.tttSec
      : Math.min(script.tttSec, phaseProgress01 * script.phases[countdownIndex]!.durationSec);

  return {
    phase,
    phaseIndex,
    phaseProgress01,
    elapsedSec: clampedSec,
    totalSec,
    links: Object.freeze(namedLinks),
    serving,
    winner,
    tttElapsedSec,
    tttSec: script.tttSec,
    servingBelowThreshold,
    replacementLeads,
    blockedByThreshold: replacementLeads && !servingBelowThreshold,
    committed,
    switchProgress01,
  };
}
