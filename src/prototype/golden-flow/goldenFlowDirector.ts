import { loadSixActsTeachingWindow } from '../../course/sixActs/teachingWindow';
import {
  GOLDEN_FLOW_ACT3_HREF,
  GOLDEN_FLOW_ACT4_HREF,
} from './goldenFlowRoutes';

export {
  GOLDEN_FLOW_ACT3_HREF,
  GOLDEN_FLOW_ACT4_HREF,
  GOLDEN_FLOW_ROUTE,
} from './goldenFlowRoutes';

/**
 * The Golden Flow is a director contract, not a second scientific runtime.
 * These namespaces are deliberately disjoint: the paused UE-position lesson is
 * a teaching comparison, while the later handover is source-backed replay.
 */
export type GoldenFlowTruthNamespace =
  | 'scene'
  | 'geometry-teaching'
  | 'teaching-counterfactual'
  | 'source-backed-replay'
  | 'source-backed-handover';

export type GoldenFlowBeatId =
  | 'establish'
  | 'angles'
  | 'interaction'
  | 'consequence'
  | 'restore'
  | 'candidate'
  | 'qualification'
  | 'ttt'
  | 'trace'
  | 'commit'
  | 'receipt'
  | 'new-normal';

export const GOLDEN_FLOW_BEAT_IDS: readonly GoldenFlowBeatId[] = Object.freeze([
  'establish',
  'angles',
  'interaction',
  'consequence',
  'restore',
  'candidate',
  'qualification',
  'ttt',
  'trace',
  'commit',
  'receipt',
  'new-normal',
]);

export type GoldenFlowCameraPose =
  | 'wide-oblique'
  | 'side-angle'
  | 'top-angle'
  | 'pair-wide'
  | 'pair-close'
  | 'commit-wide'
  | 'new-normal';

export type GoldenFlowCameraTarget =
  | 'serving-link'
  | 'angle-vertices'
  | 'ground-terminal'
  | 'counterfactual-link'
  | 'restore-boundary'
  | 'source-candidate-pair'
  | 'qualification-pair'
  | 'ttt-target'
  | 'trace-safe-area'
  | 'handover-transfer'
  | 'receipt-link'
  | 'new-serving-link';

export type GoldenFlowCameraTransition = 'cut' | 'ease' | 'hold' | 'restore';

export type GoldenFlowControlId =
  | 'ue-drag'
  | 'replay'
  | 'next'
  | 'replay-act3'
  | 'next-act4';

export type GoldenFlowControlAvailabilityMode =
  | 'none'
  | 'guided-pause'
  | 'after-stable-hold';

export interface GoldenFlowControlAvailability {
  readonly mode: GoldenFlowControlAvailabilityMode;
  /** Seconds elapsed in the beat before the declared controls may mount. */
  readonly availableAfterSec: number;
}

export type GoldenFlowPrimaryCue =
  | 'scene-establish'
  | 'angle-arcs'
  | 'ue-drag'
  | 'link-consequence'
  | 'counterfactual-discard'
  | 'candidate-arrival'
  | 'qualification-mark'
  | 'ttt-ring'
  | 'delta-trace'
  | 'commit-pulse'
  | 'event-receipt'
  | 'new-serving-link';

export type GoldenFlowPlaybackMode = 'autoplay' | 'guided';

export interface GoldenFlowCameraSpec {
  readonly pose: GoldenFlowCameraPose;
  readonly target: GoldenFlowCameraTarget;
  readonly transition: GoldenFlowCameraTransition;
}

export interface GoldenFlowPlaybackSpec {
  /** 0 is an intentional visual hold, not an omitted playback value. */
  readonly speed: number;
  readonly slowMotion: boolean;
  readonly stableHoldSec: number;
}

export interface GoldenFlowFreezeState {
  readonly time: 'moving' | 'frozen' | 'restoring';
  readonly satellite: 'fixed' | 'moving';
  readonly ue: 'fixed' | 'moving' | 'restoring';
  readonly beamAxis: 'source' | 'teaching' | 'restoring';
  readonly replay: 'source-backed' | 'teaching-only' | 'restoring';
}

export interface GoldenFlowTraceEvidenceReference {
  readonly expectedCount: 2;
  readonly anchorEvidence: readonly ['qualification.anchors[0]', 'qualification.anchors[1]'];
  readonly ordering: 'strictly-increasing-anchor-index-and-instant';
  readonly phase: 'qualification-to-commit';
  readonly connector: 'none';
  readonly digestEvidence: 'selection.traceDigest';
}

export interface GoldenFlowSourceEventReference {
  readonly eventIdEvidence: string;
  readonly action: 'inter-handover';
  readonly sourceSatelliteEvidence: string;
  readonly targetSatelliteEvidence: string;
  readonly offsetEvidence: string;
  readonly tttEvidence: string;
  readonly traceEvidence: GoldenFlowTraceEvidenceReference;
}

export interface GoldenFlowTruthReference {
  readonly namespace: GoldenFlowTruthNamespace;
  /** A locator/contract name, never a claim that the current UI has this data. */
  readonly source: string;
  readonly evidenceIds: readonly string[];
  readonly sourceEvent: GoldenFlowSourceEventReference | null;
}

export interface GoldenFlowCaptureSpec {
  readonly frameKey: string;
  readonly screenshot: 'required';
  readonly slideFrame: boolean;
  readonly status: 'candidate-evidence';
}

export interface GoldenFlowLearnerAction {
  readonly kind: 'ue-drag';
  readonly target: 'ue';
  readonly gestureLimit: 1;
  readonly optionalResponse: true;
}

export interface GoldenFlowGuidanceSpec {
  readonly mode: GoldenFlowPlaybackMode;
  /** Nullable on autoplay beats by contract. */
  readonly predictionPrompt: string | null;
  /** At most one gesture; nullable outside the one guided beat. */
  readonly optionalGesture: GoldenFlowLearnerAction | null;
  /** The evidence key is declared even before a runtime records it. */
  readonly predictionEvidenceKey: string | null;
}

export interface GoldenFlowCompletionSpec {
  readonly condition: string;
  readonly evidenceKey: string;
}

export interface GoldenFlowBeat {
  readonly id: GoldenFlowBeatId;
  readonly order: number;
  readonly durationSec: number;

  /* Existing renderer-facing fields retained for compatibility. */
  readonly camera: GoldenFlowCameraPose;
  readonly speed: number;
  readonly eyebrow: string;
  readonly caption: readonly [string, string?];
  readonly primaryCue: GoldenFlowPrimaryCue;

  /* WI-03 director contract: these fields are not persistent student cards. */
  readonly learningQuestion: string;
  readonly visiblePhenomenon: string;
  readonly cameraSpec: GoldenFlowCameraSpec;
  readonly playback: GoldenFlowPlaybackSpec;
  readonly controls: readonly GoldenFlowControlId[];
  readonly controlAvailability: GoldenFlowControlAvailability;
  readonly hiddenSurfaces: readonly string[];
  readonly freeze: GoldenFlowFreezeState;
  readonly truth: GoldenFlowTruthReference;
  readonly capture: GoldenFlowCaptureSpec;
  readonly learnerAction: GoldenFlowLearnerAction | null;
  readonly expectedObservation: string;
  readonly causalExplanation: string;
  readonly misconceptionGuard: string;
  readonly unavailableBehavior: string;
  readonly failureBehavior: string;
  readonly recoveryBehavior: string;
  readonly resetBehavior: string;
  readonly completion: GoldenFlowCompletionSpec;
  readonly guidance: GoldenFlowGuidanceSpec;
}

export const GOLDEN_FLOW_SURFACES = Object.freeze([
  'left-rail',
  'right-rail',
  'top-nav',
  'bottom-timeline',
  'course-outline',
  'engineering-controls',
  'candidate-comparator',
  'ttt-ring',
  'discrete-anchor-trace',
  'commit-pulse',
  'event-receipt',
  'pause-inspector',
] as const);

export const GOLDEN_FLOW_CONTROLS_BY_BEAT: Readonly<Record<GoldenFlowBeatId, readonly GoldenFlowControlId[]>> = Object.freeze({
  establish: [],
  angles: [],
  interaction: ['ue-drag'],
  consequence: [],
  restore: [],
  candidate: [],
  qualification: [],
  ttt: [],
  trace: [],
  commit: [],
  receipt: [],
  'new-normal': ['replay', 'next'],
});

export const GOLDEN_FLOW_TRACE_EVIDENCE: GoldenFlowTraceEvidenceReference = Object.freeze({
  expectedCount: 2,
  anchorEvidence: ['qualification.anchors[0]', 'qualification.anchors[1]'] as const,
  ordering: 'strictly-increasing-anchor-index-and-instant',
  phase: 'qualification-to-commit',
  connector: 'none',
  digestEvidence: 'selection.traceDigest',
});

const SOURCE_HANDOVER_REFERENCE: GoldenFlowSourceEventReference = Object.freeze({
  eventIdEvidence: 'selection.logicalEventKey',
  action: 'inter-handover',
  sourceSatelliteEvidence: 'pair.from.satelliteId',
  targetSatelliteEvidence: 'pair.to.satelliteId',
  offsetEvidence: 'window.handoverPolicy.offsetDb',
  tttEvidence: 'window.handoverPolicy.tttSec',
  traceEvidence: GOLDEN_FLOW_TRACE_EVIDENCE,
});

const SCENE_TRUTH: GoldenFlowTruthReference = Object.freeze({
  namespace: 'scene',
  source: 'ADR-009::B/C::scene-and-link-geometry',
  evidenceIds: Object.freeze(['scene.selected-frame', 'scene.serving-link']),
  sourceEvent: null,
});

const GEOMETRY_TRUTH: GoldenFlowTruthReference = Object.freeze({
  namespace: 'geometry-teaching',
  source: 'ADR-009::C::angle-vertices',
  evidenceIds: Object.freeze(['geometry.ue-vertex', 'geometry.satellite-vertex']),
  sourceEvent: null,
});

const COUNTERFACTUAL_TRUTH: GoldenFlowTruthReference = Object.freeze({
  namespace: 'teaching-counterfactual',
  source: 'ADR-007::B::guided-presentation-state',
  evidenceIds: Object.freeze([
    'counterfactual.pre-frame',
    'counterfactual.post-frame',
    'counterfactual.ue-position-action',
  ]),
  sourceEvent: null,
});

const RESTORE_TRUTH: GoldenFlowTruthReference = Object.freeze({
  namespace: 'source-backed-replay',
  source: 'ADR-007::A::immutable-evidence-state',
  evidenceIds: Object.freeze([
    'restore.pre-interaction-snapshot',
    'restore.equality-barrier',
    'restore.zero-counterfactual-persistence',
  ]),
  sourceEvent: null,
});

const HANDOVER_TRUTH: GoldenFlowTruthReference = Object.freeze({
  namespace: 'source-backed-handover',
  source: 'src/course/sixActs/fixtures/teachingWindow.generated.json',
  evidenceIds: Object.freeze([
    'selection.logicalEventKey',
    'selection.traceDigest',
    'window.handoverPolicy.offsetDb',
    'window.handoverPolicy.tttSec',
  ]),
  sourceEvent: SOURCE_HANDOVER_REFERENCE,
});

function hiddenSurfaces(...visible: readonly string[]): readonly string[] {
  const visibleSet = new Set(visible);
  return Object.freeze(GOLDEN_FLOW_SURFACES.filter(surface => !visibleSet.has(surface)));
}

function autoplayGuidance(): GoldenFlowGuidanceSpec {
  return Object.freeze({
    mode: 'autoplay',
    predictionPrompt: null,
    optionalGesture: null,
    predictionEvidenceKey: null,
  });
}

function freezeBeat(
  value: GoldenFlowBeat,
): GoldenFlowBeat {
  return Object.freeze({
    ...value,
    caption: Object.freeze([...value.caption]) as readonly [string, string?],
    controls: Object.freeze([...value.controls]),
    controlAvailability: Object.freeze({ ...value.controlAvailability }),
    hiddenSurfaces: Object.freeze([...value.hiddenSurfaces]),
    truth: Object.freeze({
      ...value.truth,
      evidenceIds: Object.freeze([...value.truth.evidenceIds]),
    }),
    capture: Object.freeze({ ...value.capture }),
    freeze: Object.freeze({ ...value.freeze }),
    cameraSpec: Object.freeze({ ...value.cameraSpec }),
    playback: Object.freeze({ ...value.playback }),
    completion: Object.freeze({ ...value.completion }),
    guidance: Object.freeze({ ...value.guidance }),
  });
}

const GUIDED_ACTION: GoldenFlowLearnerAction = Object.freeze({
  kind: 'ue-drag',
  target: 'ue',
  gestureLimit: 1,
  optionalResponse: true,
});

/**
 * An authored freeze is part of the beat contract, not an emergent renderer
 * state.  It covers both the explicitly frozen teaching comparison and the
 * restore barrier, while leaving the source-backed handover beats moving.
 */
export function goldenFlowBeatHasAuthoredMotionHold(
  beat: GoldenFlowBeat | GoldenFlowBeatId,
): boolean {
  const freeze = typeof beat === 'string'
    ? GOLDEN_FLOW_BEATS.find(currentBeat => currentBeat.id === beat)?.freeze
    : beat.freeze;
  return freeze !== undefined && (freeze.time !== 'moving' || freeze.satellite === 'fixed');
}

export type GoldenFlowMotionState = 'moving' | 'frozen';

/**
 * Transport pause has the same visual contract as an authored explanation
 * hold: every satellite uses the last transport-clock frame until playback
 * resumes.  No wall-clock animation may override this result.
 */
export function goldenFlowMotionState(
  isPlaying: boolean,
  authoredMotionHold: boolean,
): GoldenFlowMotionState {
  return isPlaying && !authoredMotionHold ? 'moving' : 'frozen';
}

/** One 84-second, 12-beat contract. Text is an internal spec, not a card. */
export const GOLDEN_FLOW_BEATS: readonly GoldenFlowBeat[] = Object.freeze([
  freezeBeat({
    id: 'establish', order: 1, durationSec: 5, camera: 'side-angle', speed: 1,
    eyebrow: '01 · 服務鏈路基準',
    caption: ['固定服務衛星與地面終端。'],
    primaryCue: 'scene-establish',
    learningQuestion: '現在是哪一條鏈路正在服務 UE？',
    visiblePhenomenon: 'UE、來源衛星、波束中軸與鏈路同時建立。',
    cameraSpec: { pose: 'side-angle', target: 'serving-link', transition: 'hold' },
    playback: { speed: 1, slowMotion: false, stableHoldSec: 0 },
    controls: GOLDEN_FLOW_CONTROLS_BY_BEAT.establish,
    controlAvailability: { mode: 'none', availableAfterSec: 0 },
    hiddenSurfaces: hiddenSurfaces(),
    freeze: { time: 'moving', satellite: 'moving', ue: 'moving', beamAxis: 'source', replay: 'source-backed' },
    truth: SCENE_TRUTH,
    capture: { frameKey: 'GF-01-establish', screenshot: 'required', slideFrame: true, status: 'candidate-evidence' },
    learnerAction: null,
    expectedObservation: '一條來源鏈路清楚連到 UE，其他資訊不搶主視覺。',
    causalExplanation: '場景先建立服務關係，後續角度說明都指向同一條鏈路。',
    misconceptionGuard: '這是空間關係的建立，不是完整候選排名。',
    unavailableBehavior: '若來源鏈路不可用，停在空場景並標記來源資料不可用。',
    failureBehavior: '來源 frame 不完整時不播放下一拍。',
    recoveryBehavior: '保留最後完整 frame，提供重新載入來源的恢復路徑。',
    resetBehavior: '回到來源 frame、來源波束與第一拍。',
    completion: { condition: 'serving-link-and-ue-are-visible', evidenceKey: 'golden.establish.scene-visible' },
    guidance: autoplayGuidance(),
  }),
  freezeBeat({
    id: 'angles', order: 2, durationSec: 8, camera: 'side-angle', speed: 0,
    eyebrow: '02 · 先固定幾何仰角',
    caption: ['仰角 α：以地面 UE 為頂點。', '固定 α＝55°；下一段再從衛星端觀察 θ。'],
    primaryCue: 'angle-arcs',
    learningQuestion: '仰角 α 是從哪裡量起？',
    visiblePhenomenon: '只呈現 UE 頂點的仰角弧，衛星端離軸角留到下一個互動階段。',
    cameraSpec: { pose: 'side-angle', target: 'angle-vertices', transition: 'ease' },
    playback: { speed: 0, slowMotion: true, stableHoldSec: 8 },
    controls: GOLDEN_FLOW_CONTROLS_BY_BEAT.angles,
    controlAvailability: { mode: 'none', availableAfterSec: 0 },
    hiddenSurfaces: hiddenSurfaces(),
    freeze: { time: 'frozen', satellite: 'fixed', ue: 'fixed', beamAxis: 'source', replay: 'source-backed' },
    truth: GEOMETRY_TRUTH,
    capture: { frameKey: 'GF-02-elevation-anchor', screenshot: 'required', slideFrame: true, status: 'candidate-evidence' },
    learnerAction: null,
    expectedObservation: '仰角弧以地面 UE 為頂點，並相對水平參考線量測。',
    causalExplanation: '先固定地面觀測幾何，下一階段才能只改變並辨認衛星端離軸角。',
    misconceptionGuard: '本段只說明仰角；下一段的離軸角使用衛星作為頂點。',
    unavailableBehavior: '若角度 frame 缺欄位，只顯示頂點示意，不顯示數值。',
    failureBehavior: '若 UE 頂點或水平參考線無法投影，停止在建立拍並標記幾何不可用。',
    recoveryBehavior: '切回 side-angle preset 後重新投影 UE 頂點與水平參考線。',
    resetBehavior: '恢復來源鏡位、固定波束中心與 UE 初始位置。',
    completion: { condition: 'ue-elevation-vertex-is-visible', evidenceKey: 'golden.angles.elevation-anchor' },
    guidance: autoplayGuidance(),
  }),
  freezeBeat({
    id: 'interaction', order: 3, durationSec: 10, camera: 'side-angle', speed: 0,
    eyebrow: '03 · 拖動 UE，觀察理想補償功率需求與相對 EE',
    caption: ['固定衛星、波束中心與仰角。', '向右拖曳 UE，觀察離軸角、增益、理想補償功率需求與相對 EE。'],
    primaryCue: 'ue-drag',
    learningQuestion: 'UE 離開波束中心後，理想補償功率需求與相對 EE 如何改變？',
    visiblePhenomenon: '時間、衛星與波束中軸凍結；只有地面 UE 沿等仰角路徑向畫面右側移動。',
    cameraSpec: { pose: 'side-angle', target: 'ground-terminal', transition: 'hold' },
    playback: { speed: 0, slowMotion: true, stableHoldSec: 0 },
    controls: GOLDEN_FLOW_CONTROLS_BY_BEAT.interaction,
    controlAvailability: { mode: 'guided-pause', availableAfterSec: 0 },
    hiddenSurfaces: hiddenSurfaces(),
    freeze: { time: 'frozen', satellite: 'fixed', ue: 'moving', beamAxis: 'source', replay: 'teaching-only' },
    truth: COUNTERFACTUAL_TRUTH,
    capture: { frameKey: 'GF-03-guided-ue-position', screenshot: 'required', slideFrame: true, status: 'candidate-evidence' },
    learnerAction: GUIDED_ACTION,
    expectedObservation: '拖曳 UE 時，離軸角、相對增益、理想補償功率需求與相對 EE 同步更新。',
    causalExplanation: '波束中心保持固定；離軸角增加使增益下降，維持相同服務量的理想補償功率需求上升，相對 EE 下降。',
    misconceptionGuard: '拖曳不是換手操作，也不會改變衛星、時間、波束指向或仰角。',
    unavailableBehavior: '若 UE 地面路徑或角度結果不可用，停在凍結畫面並顯示不可用。',
    failureBehavior: '若拖曳未留下有效偏移，維持 paused，不自動跳拍。',
    recoveryBehavior: '重新開始後允許一次有效 UE 拖曳；超出上限則重設。',
    resetBehavior: '把 UE 放回波束中心，回到互動前畫面並重置證據。',
    completion: { condition: 'prediction-recorded-and-one-ue-position-action-or-explicit-skip-recorded', evidenceKey: 'golden.counterfactual.action-complete' },
    guidance: Object.freeze({
      mode: 'guided',
      predictionPrompt: 'UE 離開波束中心後，理想補償功率需求與相對 EE 會如何改變？',
      optionalGesture: GUIDED_ACTION,
      predictionEvidenceKey: 'golden.counterfactual.prediction-recorded',
    }),
  }),
  freezeBeat({
    id: 'consequence', order: 4, durationSec: 8, camera: 'side-angle', speed: 0,
    eyebrow: '04 · 離軸角的鏈路後果',
    caption: ['離軸角增加，增益下降。', '理想補償功率需求上升，相對 EE 下降。'],
    primaryCue: 'link-consequence',
    learningQuestion: '為什麼離軸角增加會提高理想補償功率需求？',
    visiblePhenomenon: '仰角維持 55°；四個 canonical angle-aware readout 顯示同一條因果鏈。',
    cameraSpec: { pose: 'side-angle', target: 'counterfactual-link', transition: 'hold' },
    playback: { speed: 0, slowMotion: true, stableHoldSec: 0 },
    controls: GOLDEN_FLOW_CONTROLS_BY_BEAT.consequence,
    controlAvailability: { mode: 'none', availableAfterSec: 0 },
    hiddenSurfaces: hiddenSurfaces(),
    freeze: { time: 'frozen', satellite: 'fixed', ue: 'fixed', beamAxis: 'source', replay: 'teaching-only' },
    truth: COUNTERFACTUAL_TRUTH,
    capture: { frameKey: 'GF-04-counterfactual-consequence', screenshot: 'required', slideFrame: true, status: 'candidate-evidence' },
    learnerAction: null,
    expectedObservation: 'elevation 維持，theta 增加、G^T 下降、理想補償功率需求上升、相對 EE 下降。',
    causalExplanation: 'UE 相對固定波束中心的位置先改變離軸角，再由核准的角度感知計算鏈顯示理想補償功率需求與 EE 結果。',
    misconceptionGuard: '示意亮度不是 measured SINR；此拍也不是後續 handover 的原因。',
    unavailableBehavior: '若 approved link result 不可用，只保留幾何後果並清楚標示。',
    failureBehavior: '若 elevation 未保持固定，counterfactual gate fail-closed。',
    recoveryBehavior: '回到互動前畫面，重新建立只移動 UE 的比較。',
    resetBehavior: '清除 counterfactual result，不寫入 replay、handover 或 platform。',
    completion: { condition: 'fixed-elevation-and-changed-off-axis-are-visible', evidenceKey: 'golden.counterfactual.consequence-visible' },
    guidance: autoplayGuidance(),
  }),
  freezeBeat({
    id: 'restore', order: 5, durationSec: 5, camera: 'side-angle', speed: 0,
    eyebrow: '05 · 恢復來源資料狀態',
    caption: ['移除教學偏移。', '確認來源狀態後繼續。'],
    primaryCue: 'counterfactual-discard',
    learningQuestion: '如何證明剛才的教學偏移沒有污染 replay？',
    visiblePhenomenon: 'UE 回到波束中心，互動前畫面恢復，資料邊界提示短暫亮起。',
    cameraSpec: { pose: 'side-angle', target: 'restore-boundary', transition: 'hold' },
    playback: { speed: 0, slowMotion: true, stableHoldSec: 0 },
    controls: GOLDEN_FLOW_CONTROLS_BY_BEAT.restore,
    controlAvailability: { mode: 'none', availableAfterSec: 0 },
    hiddenSurfaces: hiddenSurfaces(),
    freeze: { time: 'restoring', satellite: 'fixed', ue: 'restoring', beamAxis: 'source', replay: 'restoring' },
    truth: RESTORE_TRUTH,
    capture: { frameKey: 'GF-05-restore-barrier', screenshot: 'required', slideFrame: false, status: 'candidate-evidence' },
    learnerAction: null,
    expectedObservation: 'source frame/replay identity 與所有 restore equality fields 回到原值。',
    causalExplanation: '恢復是資料邊界，不是把 counterfactual 結果併入真實事件。',
    misconceptionGuard: '後面的來源換手 replay 與剛才拖曳沒有因果連結。',
    unavailableBehavior: '若 equality barrier 無法證明，停止，不進入 handover 劇場。',
    failureBehavior: '任何 serving/candidate/event/platform count 差異都 fail-closed。',
    recoveryBehavior: '丟棄整個 teaching namespace，重新載入 pre-interaction snapshot。',
    resetBehavior: '回到互動前，教學用 UE 位移不得留在後續事件資料中。',
    completion: { condition: 'restore-equality-barrier-passes', evidenceKey: 'golden.restore.equality-passed' },
    guidance: autoplayGuidance(),
  }),
  freezeBeat({
    id: 'candidate', order: 6, durationSec: 10, camera: 'pair-wide', speed: 0.75,
    eyebrow: '06 · 比較候選集合',
    caption: ['目前只有一條服務鏈路。', '三顆候選只提供 SINR 量測，尚未連線。'],
    primaryCue: 'candidate-arrival',
    learningQuestion: '系統如何從候選集合選出換手目標？',
    visiblePhenomenon: '服務波束維持單一；三顆候選以虛線量測，並依 SINR 排出目前最佳目標。',
    cameraSpec: { pose: 'pair-wide', target: 'source-candidate-pair', transition: 'ease' },
    playback: { speed: 0.75, slowMotion: true, stableHoldSec: 0 },
    controls: GOLDEN_FLOW_CONTROLS_BY_BEAT.candidate,
    controlAvailability: { mode: 'none', availableAfterSec: 0 },
    hiddenSurfaces: hiddenSurfaces('candidate-comparator'),
    freeze: { time: 'moving', satellite: 'moving', ue: 'fixed', beamAxis: 'source', replay: 'source-backed' },
    truth: HANDOVER_TRUTH,
    capture: { frameKey: 'GF-06-candidate-arrival', screenshot: 'required', slideFrame: false, status: 'candidate-evidence' },
    learnerAction: null,
    expectedObservation: 'B1 的候選 SINR 最高，但尚未通過門檻時，服務關係仍保持不變。',
    causalExplanation: '系統先在候選集合中選出最佳量測，再把該目標與目前服務 SINR 比較；排名第一不等於立即換手。',
    misconceptionGuard: '候選量測不代表第二條服務鏈路；此處不是 DAPS 或雙連線。',
    unavailableBehavior: '沒有 source-backed candidate 時停在來源畫面並顯示不可用。',
    failureBehavior: 'candidate identity、event ID 或 source anchor 不匹配時拒絕播放。',
    recoveryBehavior: '回到 restore-passed barrier，重新讀取 pinned event evidence。',
    resetBehavior: '移除 candidate cue，回到 source-backed pre-event frame。',
    completion: { condition: 'source-and-pending-target-cues-visible', evidenceKey: 'golden.handover.candidate-visible' },
    guidance: autoplayGuidance(),
  }),
  freezeBeat({
    id: 'qualification', order: 7, durationSec: 10, camera: 'pair-close', speed: 0.5,
    eyebrow: '07 · 候選優勢跨越 3 dB 閾值',
    caption: ['差值達到偏移門檻。', '尚未提交換手。'],
    primaryCue: 'qualification-mark',
    learningQuestion: '候選何時通過比較門檻？',
    visiblePhenomenon: '服務波束仍只有一條；候選量測與目前服務的差值跨越 3 dB 門檻。',
    cameraSpec: { pose: 'pair-close', target: 'qualification-pair', transition: 'ease' },
    playback: { speed: 0.5, slowMotion: true, stableHoldSec: 0 },
    controls: GOLDEN_FLOW_CONTROLS_BY_BEAT.qualification,
    controlAvailability: { mode: 'none', availableAfterSec: 0 },
    hiddenSurfaces: hiddenSurfaces('candidate-comparator'),
    freeze: { time: 'moving', satellite: 'moving', ue: 'fixed', beamAxis: 'source', replay: 'source-backed' },
    truth: HANDOVER_TRUTH,
    capture: { frameKey: 'GF-07-qualification', screenshot: 'required', slideFrame: true, status: 'candidate-evidence' },
    learnerAction: null,
    expectedObservation: 'candidate − serving 的 source-backed delta 跨過 configured offset。',
    causalExplanation: 'qualification 是來源事件條件；它只說明候選目前符合門檻，還沒有 commit。',
    misconceptionGuard: '候選通過門檻仍未建立服務鏈路，也不代表立即換手。',
    unavailableBehavior: '若 offset 或 pre-commit delta 缺失，顯示條件不可用並停止。',
    failureBehavior: '若 delta 低於 offset，回到 candidate beat，不建立 qualification cue。',
    recoveryBehavior: '等待下一個有效 source anchor，重做 qualification 檢查。',
    resetBehavior: '清除 qualification mark，保留原 source/candidate identity。',
    completion: { condition: 'source-delta-meets-configured-offset', evidenceKey: 'golden.handover.qualification-passed' },
    guidance: autoplayGuidance(),
  }),
  freezeBeat({
    id: 'ttt', order: 8, durationSec: 12, camera: 'pair-close', speed: 0.25,
    eyebrow: '08 · 持續條件驗證（TTT）',
    caption: ['候選優勢需持續滿足觸發時間。', '瞬間越過門檻不會切換。'],
    primaryCue: 'ttt-ring',
    learningQuestion: '通過門檻後，為什麼還不能立刻切換？',
    visiblePhenomenon: '兩顆衛星持續移動；TTT 從 0 累積至 30 秒，服務關係尚未切換。',
    cameraSpec: { pose: 'pair-close', target: 'ttt-target', transition: 'hold' },
    playback: { speed: 0.25, slowMotion: true, stableHoldSec: 0 },
    controls: GOLDEN_FLOW_CONTROLS_BY_BEAT.ttt,
    controlAvailability: { mode: 'none', availableAfterSec: 0 },
    hiddenSurfaces: hiddenSurfaces('ttt-ring'),
    freeze: { time: 'moving', satellite: 'moving', ue: 'fixed', beamAxis: 'source', replay: 'source-backed' },
    truth: HANDOVER_TRUTH,
    capture: { frameKey: 'GF-08-ttt', screenshot: 'required', slideFrame: false, status: 'candidate-evidence' },
    learnerAction: null,
    expectedObservation: 'TTT ring 依 source trigger progress 前進，未完成不能 commit。',
    causalExplanation: 'TTT 要求 offset condition 在來源時間上持續，而非只看一個瞬間。',
    misconceptionGuard: 'ring 不是 decorative timer；也不是連續 SINR trace。',
    unavailableBehavior: '若 trigger progress 或 TTT 設定不可用，停在 qualification。',
    failureBehavior: '條件中途失效時 progress 歸零並回到 candidate/qualification。',
    recoveryBehavior: '使用下一個合格 source anchor 重新累積 TTT。',
    resetBehavior: '移除 ring，保留 source-backed replay identity，不改 event count。',
    completion: { condition: 'source-ttt-progress-reaches-configured-duration', evidenceKey: 'golden.handover.ttt-complete' },
    guidance: autoplayGuidance(),
  }),
  freezeBeat({
    id: 'trace', order: 9, durationSec: 10, camera: 'pair-close', speed: 0.5,
    eyebrow: '09 · 確認條件持續成立',
    caption: ['候選優勢在 TTT 期間維持於門檻以上。', '若中途跌破門檻，計時必須重置。'],
    primaryCue: 'delta-trace',
    learningQuestion: 'TTT 期間，候選優勢是否曾跌破門檻？',
    visiblePhenomenon: '判定鏈顯示門檻已通過且 TTT 已完成，換手仍等待提交。',
    cameraSpec: { pose: 'pair-close', target: 'trace-safe-area', transition: 'cut' },
    playback: { speed: 0.5, slowMotion: true, stableHoldSec: 0 },
    controls: GOLDEN_FLOW_CONTROLS_BY_BEAT.trace,
    controlAvailability: { mode: 'none', availableAfterSec: 0 },
    hiddenSurfaces: hiddenSurfaces('discrete-anchor-trace'),
    freeze: { time: 'moving', satellite: 'moving', ue: 'fixed', beamAxis: 'source', replay: 'source-backed' },
    truth: HANDOVER_TRUTH,
    capture: { frameKey: 'GF-09-two-source-anchors', screenshot: 'required', slideFrame: true, status: 'candidate-evidence' },
    learnerAction: null,
    expectedObservation: 'trace anchor count exactly 2，且順序由 qualification 到 commit。',
    causalExplanation: '這是來源事件保存的離散證據，不把兩點之間補成連續量測。',
    misconceptionGuard: '不能把離散錨點當成完整 SINR 曲線或每秒遙測。',
    unavailableBehavior: '少於兩個或順序錯誤時，trace 不渲染並停在 TTT。',
    failureBehavior: '任何額外 anchor、polyline 或非遞增時間都 fail-closed。',
    recoveryBehavior: '重新載入 source trace，確認兩個 anchor 與 digest 後再播放。',
    resetBehavior: '清除 trace cue，回到已完成 TTT 的 source replay。',
    completion: { condition: 'exactly-two-ordered-source-anchors-without-line', evidenceKey: 'golden.handover.trace-two-anchors' },
    guidance: autoplayGuidance(),
  }),
  freezeBeat({
    id: 'commit', order: 10, durationSec: 10, camera: 'commit-wide', speed: 0.1,
    eyebrow: '10 · 跨衛星換手提交',
    caption: ['3 dB 閾值與 30 秒 TTT 均成立。', '服務關係才轉移至候選衛星。'],
    primaryCue: 'commit-pulse',
    learningQuestion: '什麼時刻才算真正提交跨衛星換手？',
    visiblePhenomenon: '切換點前只有原服務波束；切換點後只有新服務波束，UE 顯示一次提交脈衝。',
    cameraSpec: { pose: 'commit-wide', target: 'handover-transfer', transition: 'ease' },
    playback: { speed: 0.1, slowMotion: true, stableHoldSec: 0 },
    controls: GOLDEN_FLOW_CONTROLS_BY_BEAT.commit,
    controlAvailability: { mode: 'none', availableAfterSec: 0 },
    hiddenSurfaces: hiddenSurfaces('commit-pulse'),
    freeze: { time: 'moving', satellite: 'moving', ue: 'fixed', beamAxis: 'source', replay: 'source-backed' },
    truth: HANDOVER_TRUTH,
    capture: { frameKey: 'GF-10-inter-commit', screenshot: 'required', slideFrame: true, status: 'candidate-evidence' },
    learnerAction: null,
    expectedObservation: 'commit action 是 inter-handover，且 source identity 非 null。',
    causalExplanation: 'offset + TTT source evidence 滿足後，engine 才提交來源到目標的 handover event。',
    misconceptionGuard: '切換前後皆只有一條服務鏈路，不呈現 DAPS 或雙連線。',
    unavailableBehavior: '沒有 source event/action 或 source identity 時，commit pulse 不渲染。',
    failureBehavior: 'action 不是 inter-handover 或 source 為 null 時立即阻擋。',
    recoveryBehavior: '回到 source trace，重新驗證 event ID、action 與兩個 anchor。',
    resetBehavior: '移除 commit pulse，不增加 event count，回到 TTT-complete state。',
    completion: { condition: 'inter-handover-with-non-null-source-is-committed', evidenceKey: 'golden.handover.inter-commit' },
    guidance: autoplayGuidance(),
  }),
  freezeBeat({
    id: 'receipt', order: 11, durationSec: 10, camera: 'commit-wide', speed: 0.5,
    eyebrow: '11 · 確認新的服務關係',
    caption: ['候選衛星已成為新的服務衛星。', '舊鏈路退出，兩顆衛星仍持續運行。'],
    primaryCue: 'event-receipt',
    learningQuestion: '這個事件的可追溯收據包含什麼？',
    visiblePhenomenon: 'target link 穩定，短暫 receipt 只列 source/target/time/action。',
    cameraSpec: { pose: 'commit-wide', target: 'receipt-link', transition: 'ease' },
    playback: { speed: 0.5, slowMotion: true, stableHoldSec: 0 },
    controls: GOLDEN_FLOW_CONTROLS_BY_BEAT.receipt,
    controlAvailability: { mode: 'none', availableAfterSec: 0 },
    hiddenSurfaces: hiddenSurfaces('event-receipt'),
    freeze: { time: 'moving', satellite: 'moving', ue: 'fixed', beamAxis: 'source', replay: 'source-backed' },
    truth: HANDOVER_TRUTH,
    capture: { frameKey: 'GF-11-event-receipt', screenshot: 'required', slideFrame: true, status: 'candidate-evidence' },
    learnerAction: null,
    expectedObservation: 'receipt 與 commit 的 source/target/action/instant identity 一致。',
    causalExplanation: 'receipt 是已提交 event 的摘要，不擴充 engine 沒有提供的欄位。',
    misconceptionGuard: '不宣稱 interruption、signalling cost、energy saving 或 platform persistence。',
    unavailableBehavior: 'commit receipt 缺欄位時只顯示可驗證欄位並標示 incomplete。',
    failureBehavior: 'receipt identity 與 committed event 不一致時不顯示 receipt。',
    recoveryBehavior: '回讀 immutable committed event，再重新產生 receipt。',
    resetBehavior: '清除 receipt，保留已提交的 source-backed replay state。',
    completion: { condition: 'receipt-fields-match-committed-event', evidenceKey: 'golden.handover.receipt-matched' },
    guidance: autoplayGuidance(),
  }),
  freezeBeat({
    id: 'new-normal', order: 12, durationSec: 10, camera: 'new-normal', speed: 1,
    eyebrow: '12 · 換手後服務狀態',
    caption: ['目標衛星成為新服務者。', '幾何仍由來源重播決定。'],
    primaryCue: 'new-serving-link',
    learningQuestion: '提交後，場景如何回到可觀察的正常狀態？',
    visiblePhenomenon: '收據退場，目標服務鏈路留在中央；來源重播動態恢復。',
    cameraSpec: { pose: 'new-normal', target: 'new-serving-link', transition: 'ease' },
    playback: { speed: 1, slowMotion: false, stableHoldSec: 6 },
    controls: GOLDEN_FLOW_CONTROLS_BY_BEAT['new-normal'],
    controlAvailability: { mode: 'after-stable-hold', availableAfterSec: 6 },
    hiddenSurfaces: hiddenSurfaces(),
    freeze: { time: 'moving', satellite: 'moving', ue: 'fixed', beamAxis: 'source', replay: 'source-backed' },
    truth: HANDOVER_TRUTH,
    capture: { frameKey: 'GF-12-new-normal', screenshot: 'required', slideFrame: true, status: 'candidate-evidence' },
    learnerAction: null,
    expectedObservation: 'target identity equals committed target，畫面至少穩定 6 秒。',
    causalExplanation: 'handover 只改變 source-backed serving identity；後續幾何仍由 replay 決定。',
    misconceptionGuard: '穩定一拍不代表永遠不會再換手，也不代表節能策略成功。',
    unavailableBehavior: '若 post-commit target 不可驗證，停在 receipt。',
    failureBehavior: 'target serving identity 與 commit 不一致時不進入 new normal。',
    recoveryBehavior: '回到 receipt，重新讀取 committed post-change frame。',
    resetBehavior: '重播從第一拍開始；不保留 teaching namespace 或未授權樣本。',
    completion: { condition: 'post-commit-target-is-visible-and-stable-for-six-seconds', evidenceKey: 'golden.new-normal.stable' },
    guidance: autoplayGuidance(),
  }),
]);

export interface GoldenFlowSegment {
  readonly id: 'full' | 'act3' | 'act4';
  readonly act: 3 | 4 | null;
  readonly startBeatIndex: number;
  readonly endBeatIndex: number;
  readonly startBeatId: GoldenFlowBeatId;
  readonly endBeatId: GoldenFlowBeatId;
  readonly nextHref: string | null;
  readonly nextLabelZhHant: string | null;
}

export const GOLDEN_FLOW_SEGMENTS: Readonly<Record<GoldenFlowSegment['id'], GoldenFlowSegment>> = Object.freeze({
  full: Object.freeze({
    id: 'full', act: null, startBeatIndex: 0, endBeatIndex: GOLDEN_FLOW_BEATS.length - 1,
    startBeatId: GOLDEN_FLOW_BEATS[0]!.id, endBeatId: GOLDEN_FLOW_BEATS[GOLDEN_FLOW_BEATS.length - 1]!.id,
    nextHref: '/course/energy-lab', nextLabelZhHant: '下一個場景',
  }),
  act3: Object.freeze({
    id: 'act3', act: 3, startBeatIndex: 0, endBeatIndex: 4,
    startBeatId: GOLDEN_FLOW_BEATS[0]!.id, endBeatId: GOLDEN_FLOW_BEATS[4]!.id,
    nextHref: GOLDEN_FLOW_ACT4_HREF, nextLabelZhHant: '下一幕：換手劇場',
  }),
  act4: Object.freeze({
    id: 'act4', act: 4, startBeatIndex: 5, endBeatIndex: GOLDEN_FLOW_BEATS.length - 1,
    startBeatId: GOLDEN_FLOW_BEATS[5]!.id, endBeatId: GOLDEN_FLOW_BEATS[GOLDEN_FLOW_BEATS.length - 1]!.id,
    nextHref: null, nextLabelZhHant: null,
  }),
});

export function goldenFlowSegmentForAct(value: string | null): GoldenFlowSegment {
  if (value === '3') return GOLDEN_FLOW_SEGMENTS.act3;
  if (value === '4') return GOLDEN_FLOW_SEGMENTS.act4;
  return GOLDEN_FLOW_SEGMENTS.full;
}

export function goldenFlowSegmentDurationSec(segment: GoldenFlowSegment): number {
  return GOLDEN_FLOW_BEATS.slice(segment.startBeatIndex, segment.endBeatIndex + 1)
    .reduce((sum, currentBeat) => sum + currentBeat.durationSec, 0);
}

export function goldenFlowSegmentBeatIndex(segment: GoldenFlowSegment, beatIndex: number): number {
  return beatIndex - segment.startBeatIndex;
}

export function goldenFlowReplayBeatIndex(segment: GoldenFlowSegment): number {
  return segment.startBeatIndex;
}

export function goldenFlowShouldStopAtEnd(segment: GoldenFlowSegment, beatIndex: number): boolean {
  return beatIndex >= segment.endBeatIndex;
}

/** Returns only controls that are allowed to mount at this elapsed beat time. */
export function goldenFlowControlsAvailable(
  currentBeat: GoldenFlowBeat,
  elapsedSec: number,
): readonly GoldenFlowControlId[] {
  if (!Number.isFinite(elapsedSec) || elapsedSec < 0) return Object.freeze([]);
  if (currentBeat.controlAvailability.mode === 'none'
    || elapsedSec < currentBeat.controlAvailability.availableAfterSec) {
    return Object.freeze([]);
  }
  if (currentBeat.controlAvailability.mode === 'after-stable-hold'
    && currentBeat.playback.stableHoldSec < 6) {
    return Object.freeze([]);
  }
  return currentBeat.controls;
}

export const GOLDEN_FLOW_NOMINAL_DURATION_SEC = GOLDEN_FLOW_BEATS.reduce(
  (sum, currentBeat) => sum + currentBeat.durationSec,
  0,
);

/**
 * Act 3 is a geometry lesson, not the 10° minimum-elevation coverage test.
 * Keep the teaching scene at a visibly separated elevation so the horizon,
 * LOS, and satellite-end angle can be inspected without borrowing the Act 5
 * contact-window threshold. The handover fixture keeps its own source-backed
 * elevation; this value belongs only to the schematic Act 3 carrier.
 */
export const GOLDEN_FLOW_ANGLE_LESSON_ELEVATION_DEG = 55;

/**
 * Act 3 begins with the fixed beam boresight centred on the UE. The learner
 * creates the off-axis angle by moving the UE along a constant-elevation ground
 * path; beam pointing never changes in this lesson.
 */
export const GOLDEN_FLOW_ANGLE_LESSON_OFF_AXIS_DEG = 0;

export type GoldenFlowSceneConstellation = 'starlink' | 'oneweb';

/** Starlink is the default visual example; ?constellation=oneweb is optional comparison. */
export const GOLDEN_FLOW_DEFAULT_SCENE_CONSTELLATION: GoldenFlowSceneConstellation = 'starlink';

export function goldenFlowSceneConstellationFromSearch(search: string): GoldenFlowSceneConstellation {
  return new URLSearchParams(search).get('constellation') === 'oneweb'
    ? 'oneweb'
    : GOLDEN_FLOW_DEFAULT_SCENE_CONSTELLATION;
}

export interface GoldenFlowTimeResolution {
  readonly courseTimeSec: number;
  readonly segmentTimeSec: number;
  readonly beatIndex: number;
  readonly beat: GoldenFlowBeat;
  readonly beatElapsedSec: number;
  readonly beatProgress: number;
}

/**
 * Resolves any continuous segment time to the active beat,
 * its beat-local elapsed offset, and the beat progress [0, 1].
 */
export function courseTimeToBeat(
  segmentTimeSec: number,
  segment: GoldenFlowSegment = GOLDEN_FLOW_SEGMENTS.full,
): GoldenFlowTimeResolution {
  const durationSec = goldenFlowSegmentDurationSec(segment);
  const clampedTime = Math.max(0, Math.min(durationSec, segmentTimeSec));
  let accumulated = 0;
  for (let i = segment.startBeatIndex; i <= segment.endBeatIndex; i += 1) {
    const beat = GOLDEN_FLOW_BEATS[i]!;
    const nextAccumulated = accumulated + beat.durationSec;
    if (clampedTime < nextAccumulated || i === segment.endBeatIndex) {
      const beatElapsedSec = Math.max(0, Math.min(beat.durationSec, clampedTime - accumulated));
      const beatProgress = beat.durationSec > 0 ? beatElapsedSec / beat.durationSec : 1;
      return Object.freeze({
        courseTimeSec: clampedTime,
        segmentTimeSec: clampedTime,
        beatIndex: i,
        beat,
        beatElapsedSec,
        beatProgress,
      });
    }
    accumulated = nextAccumulated;
  }
  const lastBeat = GOLDEN_FLOW_BEATS[segment.endBeatIndex]!;
  return Object.freeze({
    courseTimeSec: durationSec,
    segmentTimeSec: durationSec,
    beatIndex: segment.endBeatIndex,
    beat: lastBeat,
    beatElapsedSec: lastBeat.durationSec,
    beatProgress: 1,
  });
}

/**
 * Converts a beat index and optional beat-local elapsed seconds to total segment course time.
 */
export function beatToCourseTime(
  beatIndex: number,
  beatElapsedSec = 0,
  segment: GoldenFlowSegment = GOLDEN_FLOW_SEGMENTS.full,
): number {
  const durationSec = goldenFlowSegmentDurationSec(segment);
  const safeIndex = Math.max(segment.startBeatIndex, Math.min(segment.endBeatIndex, beatIndex));
  let accumulated = 0;
  for (let i = segment.startBeatIndex; i < safeIndex; i += 1) {
    accumulated += GOLDEN_FLOW_BEATS[i]!.durationSec;
  }
  const targetBeat = GOLDEN_FLOW_BEATS[safeIndex]!;
  const clampedElapsed = Math.max(0, Math.min(targetBeat.durationSec, beatElapsedSec));
  return Math.min(durationSec, accumulated + clampedElapsed);
}

export const GOLDEN_FLOW_REVIEW_FRAME_OFFSET_SEC = 1;

/**
 * Review routes open on a paused, readable frame instead of the first hidden compositor instant.
 */
export function goldenFlowReviewFrameCourseTime(
  beatIndex: number,
  segment: GoldenFlowSegment = GOLDEN_FLOW_SEGMENTS.full,
): number {
  const safeIndex = Math.max(segment.startBeatIndex, Math.min(segment.endBeatIndex, beatIndex));
  const beat = GOLDEN_FLOW_BEATS[safeIndex]!;
  return beatToCourseTime(
    safeIndex,
    Math.min(GOLDEN_FLOW_REVIEW_FRAME_OFFSET_SEC, beat.durationSec),
    segment,
  );
}

export const GOLDEN_FLOW_INTERACTION_BEAT_INDEX = 2;
export const GOLDEN_FLOW_HANDOVER_BEAT_INDEX = 5;
export const GOLDEN_FLOW_HANDOVER_START_COURSE_TIME_SEC = beatToCourseTime(
  GOLDEN_FLOW_HANDOVER_BEAT_INDEX,
  0,
);
export const GOLDEN_FLOW_INTERACTION_START_COURSE_TIME_SEC = beatToCourseTime(GOLDEN_FLOW_INTERACTION_BEAT_INDEX, 0);
export const GOLDEN_FLOW_INTERACTION_END_COURSE_TIME_SEC = beatToCourseTime(
  GOLDEN_FLOW_INTERACTION_BEAT_INDEX,
  GOLDEN_FLOW_BEATS[GOLDEN_FLOW_INTERACTION_BEAT_INDEX]!.durationSec,
);
export const GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC = Math.max(
  0,
  GOLDEN_FLOW_INTERACTION_END_COURSE_TIME_SEC - 0.05,
);
// Let the learner explore well beyond the one-sided 3 dB boundary (1.66°)
// while stopping before the approved pattern's first main-lobe null near
// 4.75°. This is a real θ range, not a display-only displacement multiplier.
export const GOLDEN_FLOW_UE_TRAVEL_RANGE_DEG = 4;
export const GOLDEN_FLOW_TEACHING_MIN_GESTURE_DEG = 0.75;
// Keep the authored consequence at the readable 2° comparison; learners may
// continue dragging to 4° to inspect the sharper main-lobe-edge collapse.
export const GOLDEN_FLOW_DETERMINISTIC_TEACHING_OFFSET_DEG = 2;

export type GoldenFlowInteractionState = 'awaiting' | 'completed' | 'not-applicable';

/**
 * Seeking or replaying before the interaction beat boundary restores awaiting state.
 * Seeking to or past the interaction boundary reconstructs completed state.
 */
export function goldenFlowInteractionStateForCourseTime(
  courseTimeSec: number,
  segment: GoldenFlowSegment = GOLDEN_FLOW_SEGMENTS.full,
): GoldenFlowInteractionState {
  if (segment.id === 'act4') return 'not-applicable';
  return Number.isFinite(courseTimeSec) && courseTimeSec >= GOLDEN_FLOW_INTERACTION_END_COURSE_TIME_SEC
    ? 'completed'
    : 'awaiting';
}

export const GOLDEN_FLOW_RESTORE_EQUALITY_FIELDS = Object.freeze([
  'sourceFrameId',
  'replayIdentity',
  'servingSatelliteId',
  'candidateSatelliteId',
  'handoverManagerState',
  'eventCount',
  'platformSampleCount',
  'platformRecordCount',
  'persistedCounterfactualSampleCount',
] as const);

export interface GoldenFlowEvidenceState {
  readonly sourceFrameId: string;
  readonly replayIdentity: string;
  readonly servingSatelliteId: string | null;
  readonly candidateSatelliteId: string | null;
  readonly handoverManagerState: string;
  readonly eventCount: number;
  readonly platformSampleCount: number;
  readonly platformRecordCount: number;
  readonly persistedCounterfactualSampleCount: number;
}

export interface GoldenFlowRestoreCheck {
  readonly equal: boolean;
  readonly validBefore: boolean;
  readonly validAfter: boolean;
  readonly fields: Readonly<Record<typeof GOLDEN_FLOW_RESTORE_EQUALITY_FIELDS[number], boolean>>;
}

function isNonEmptyIdentity(value: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNonNegativeInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isValidRestoreEvidenceState(state: GoldenFlowEvidenceState): boolean {
  return isNonEmptyIdentity(state.sourceFrameId)
    && isNonEmptyIdentity(state.replayIdentity)
    && isNonEmptyIdentity(state.servingSatelliteId)
    && isNonEmptyIdentity(state.candidateSatelliteId)
    && isNonEmptyIdentity(state.handoverManagerState)
    && isFiniteNonNegativeInteger(state.eventCount)
    && isFiniteNonNegativeInteger(state.platformSampleCount)
    && isFiniteNonNegativeInteger(state.platformRecordCount)
    && state.persistedCounterfactualSampleCount === 0;
}

export function goldenFlowCheckRestoreEquality(
  before: GoldenFlowEvidenceState,
  after: GoldenFlowEvidenceState,
): GoldenFlowRestoreCheck {
  const validBefore = isValidRestoreEvidenceState(before);
  const validAfter = isValidRestoreEvidenceState(after);
  const fields = Object.freeze({
    sourceFrameId: before.sourceFrameId === after.sourceFrameId,
    replayIdentity: before.replayIdentity === after.replayIdentity,
    servingSatelliteId: before.servingSatelliteId === after.servingSatelliteId,
    candidateSatelliteId: before.candidateSatelliteId === after.candidateSatelliteId,
    handoverManagerState: before.handoverManagerState === after.handoverManagerState,
    eventCount: before.eventCount === after.eventCount,
    platformSampleCount: before.platformSampleCount === after.platformSampleCount,
    platformRecordCount: before.platformRecordCount === after.platformRecordCount,
    persistedCounterfactualSampleCount:
      after.persistedCounterfactualSampleCount === 0
      && before.persistedCounterfactualSampleCount === after.persistedCounterfactualSampleCount,
  });
  return Object.freeze({
    equal: validBefore && validAfter && Object.values(fields).every(Boolean),
    validBefore,
    validAfter,
    fields,
  });
}

export type GoldenFlowGuidedResponse = 'gesture' | 'skip' | null;

export interface GoldenFlowGuidedProgress {
  readonly predictionShown: boolean;
  readonly predictionRecorded: boolean;
  readonly response: GoldenFlowGuidedResponse;
  readonly gestureCount: number;
  readonly responseEvidenceRecorded: boolean;
  readonly actionEvidenceRecorded: boolean;
  readonly completionEvidenceRecorded: boolean;
}

export function goldenFlowGuidedProgressComplete(state: GoldenFlowGuidedProgress): boolean {
  if (!state.predictionShown || !state.predictionRecorded || !state.responseEvidenceRecorded
    || !state.completionEvidenceRecorded || !Number.isInteger(state.gestureCount)
    || state.gestureCount < 0) {
    return false;
  }
  if (state.response === 'gesture') {
    return state.gestureCount === 1 && state.actionEvidenceRecorded;
  }
  if (state.response === 'skip') {
    return state.gestureCount === 0 && !state.actionEvidenceRecorded;
  }
  return false;
}

export const GOLDEN_FLOW_COUNTERFACTUAL_BARRIER = Object.freeze({
  namespace: 'teaching-counterfactual' as const,
  fixedDimensions: Object.freeze(['time', 'satellite', 'beam-axis', 'elevation'] as const),
  mutableDimension: 'ue-ground-position' as const,
  approvedObservableChanges: Object.freeze(['off-axis-angle', 'angle-aware-link-result'] as const),
  forbiddenPersistence: Object.freeze(['replay', 'handover', 'platform'] as const),
  restoreAfterBeat: 'restore' as const,
  equalityFields: GOLDEN_FLOW_RESTORE_EQUALITY_FIELDS,
});

export const GOLDEN_FLOW_NAMESPACE_TRANSITIONS = Object.freeze([
  Object.freeze({ from: 'scene' as const, to: 'geometry-teaching' as const, beatId: 'angles' as const }),
  Object.freeze({ from: 'geometry-teaching' as const, to: 'teaching-counterfactual' as const, beatId: 'interaction' as const }),
  Object.freeze({ from: 'teaching-counterfactual' as const, to: 'source-backed-replay' as const, beatId: 'restore' as const }),
  Object.freeze({ from: 'source-backed-replay' as const, to: 'source-backed-handover' as const, beatId: 'candidate' as const }),
]);

export const GOLDEN_FLOW_FORBIDDEN_CLAIMS = Object.freeze([
  'the drag caused the later handover', 'brightness equals measured sinr', 'continuous sinr trace',
  'full candidate ranking', 'interruption time', 'signalling cost', 'energy saving',
  'platform persistence', 'live telemetry', 'required-sinr', 'requested-power inversion',
  'legacy cap semantics',
] as const);

export interface GoldenFlowVisibleCopyForbiddenClaim {
  readonly id: string;
  /** A positive-claim phrase; honest negations must not be substring-matched. */
  readonly phraseZhHant: string;
}

export const GOLDEN_FLOW_VISIBLE_COPY_FORBIDDEN_CLAIMS: readonly GoldenFlowVisibleCopyForbiddenClaim[] = Object.freeze([
  { id: 'counterfactual-causes-handover', phraseZhHant: '拖曳造成後續換手' },
  { id: 'brightness-is-measured-sinr', phraseZhHant: '亮度就是實測 SINR' },
  { id: 'continuous-sinr-trace', phraseZhHant: '連續 SINR 曲線' },
  { id: 'full-candidate-ranking', phraseZhHant: '完整候選排名' },
  { id: 'interruption-time', phraseZhHant: '有中斷時間' },
  { id: 'signalling-cost', phraseZhHant: '有訊令成本' },
  { id: 'residual-visibility', phraseZhHant: '有殘留可見性' },
  { id: 'energy-saving-success', phraseZhHant: '節能成功' },
  { id: 'energy-saving-policy', phraseZhHant: '節省能源' },
  { id: 'optimization-success', phraseZhHant: '最佳化成功' },
  { id: 'platform-saved', phraseZhHant: '平台已儲存' },
  { id: 'platform-uploaded', phraseZhHant: '已上傳平台' },
  { id: 'platform-persisted', phraseZhHant: '平台已持久化' },
  { id: 'live-telemetry', phraseZhHant: '即時遙測' },
  { id: 'attach-as-handover', phraseZhHant: 'attach 換手' },
  { id: 'stay-as-handover', phraseZhHant: 'stay 換手' },
  { id: 'intra-as-inter-handover', phraseZhHant: 'intra 換手' },
  { id: 'tle-as-handover', phraseZhHant: 'TLE 換手' },
  { id: 'legacy-required-sinr', phraseZhHant: '需求 SINR' },
  { id: 'legacy-requested-power', phraseZhHant: '請求功率反推' },
  { id: 'legacy-cap-semantics', phraseZhHant: '功率 cap 語意' },
]);

export function assertGoldenFlowVisibleCopySafe(
  beats: readonly GoldenFlowBeat[] = GOLDEN_FLOW_BEATS,
): void {
  const visibleCopy = beats.flatMap(currentBeat => [currentBeat.eyebrow, ...currentBeat.caption])
    .join(' ')
    .toLocaleLowerCase('zh-Hant');
  for (const claim of GOLDEN_FLOW_VISIBLE_COPY_FORBIDDEN_CLAIMS) {
    if (visibleCopy.includes(claim.phraseZhHant.toLocaleLowerCase('zh-Hant'))) {
      throw new Error(`visible copy contains forbidden positive claim ${claim.id}`);
    }
  }
}

/** Machine contract gate; it is not visual or owner acceptance. */
export function assertGoldenFlowContract(
  beats: readonly GoldenFlowBeat[] = GOLDEN_FLOW_BEATS,
): void {
  if (beats.length !== 12) throw new Error(`Golden Flow requires 12 beats, found ${beats.length}`);
  const ids = beats.map(currentBeat => currentBeat.id);
  if (JSON.stringify(ids) !== JSON.stringify(GOLDEN_FLOW_BEAT_IDS)) {
    throw new Error(`Golden Flow beat IDs are not exhaustive/in order: ${ids.join(',')}`);
  }
  const guided = beats.filter(currentBeat => currentBeat.guidance.mode === 'guided');
  if (guided.length !== 1 || guided[0]?.id !== 'interaction') {
    throw new Error('Golden Flow requires exactly one guided interaction beat');
  }
  if (beats.reduce((sum, currentBeat) => sum + currentBeat.durationSec, 0) !== 108) {
    throw new Error('Golden Flow nominal duration must be exactly 108 seconds');
  }

  const controls = new Set<GoldenFlowControlId>([
    'ue-drag', 'replay', 'next', 'replay-act3', 'next-act4',
  ]);
  assertGoldenFlowVisibleCopySafe(beats);
  const mountedCues = new Set<string>();
  const visibleSurfaceForCue = new Map<GoldenFlowPrimaryCue, string>([
    ['candidate-arrival', 'candidate-comparator'],
    ['qualification-mark', 'candidate-comparator'],
    ['ttt-ring', 'ttt-ring'],
    ['delta-trace', 'discrete-anchor-trace'],
    ['commit-pulse', 'commit-pulse'],
    ['event-receipt', 'event-receipt'],
  ]);
  for (const currentBeat of beats) {
    const requiredStringFields = [
      currentBeat.learningQuestion, currentBeat.visiblePhenomenon,
      currentBeat.expectedObservation, currentBeat.causalExplanation,
      currentBeat.misconceptionGuard, currentBeat.unavailableBehavior,
      currentBeat.failureBehavior, currentBeat.recoveryBehavior, currentBeat.resetBehavior,
      currentBeat.completion.condition, currentBeat.completion.evidenceKey,
      currentBeat.cameraSpec.pose,
      currentBeat.cameraSpec.target, currentBeat.cameraSpec.transition,
      currentBeat.playback.speed.toString(), currentBeat.playback.slowMotion.toString(),
      currentBeat.controlAvailability.mode, currentBeat.controlAvailability.availableAfterSec.toString(),
      currentBeat.truth.namespace, currentBeat.truth.source, currentBeat.capture.frameKey,
      currentBeat.capture.status, currentBeat.freeze.time, currentBeat.freeze.satellite,
      currentBeat.freeze.ue, currentBeat.freeze.beamAxis, currentBeat.freeze.replay,
    ];
    if (requiredStringFields.some(value => value.trim().length === 0)) {
      throw new Error(`${currentBeat.id} is missing a required director field`);
    }
    if (currentBeat.caption.length > 2 || currentBeat.caption.some(line => line !== undefined && line.trim().length === 0)) {
      throw new Error(`${currentBeat.id} has invalid caption lines`);
    }
    if (currentBeat.camera !== currentBeat.cameraSpec.pose || currentBeat.speed !== currentBeat.playback.speed) {
      throw new Error(`${currentBeat.id} legacy camera/speed fields diverge from the typed playback spec`);
    }
    if (!Number.isFinite(currentBeat.speed)
      || !Number.isFinite(currentBeat.playback.speed)
      || typeof currentBeat.capture.slideFrame !== 'boolean'
      || currentBeat.playback.stableHoldSec < 0
      || !Number.isFinite(currentBeat.playback.stableHoldSec)) {
      throw new Error(`${currentBeat.id} has invalid capture or stable-hold fields`);
    }
    if (currentBeat.primaryCue.trim().length === 0 || mountedCues.has(currentBeat.primaryCue)) {
      throw new Error(`${currentBeat.id} does not provide an exclusive primary cue`);
    }
    mountedCues.add(currentBeat.primaryCue);
    if (currentBeat.controls.some(control => !controls.has(control))) {
      throw new Error(`${currentBeat.id} uses a control outside the allowlist`);
    }
    const expectedControls = GOLDEN_FLOW_CONTROLS_BY_BEAT[currentBeat.id];
    if (JSON.stringify(currentBeat.controls) !== JSON.stringify(expectedControls)) {
      throw new Error(`${currentBeat.id} controls do not match the allowlist`);
    }
    if (!Number.isFinite(currentBeat.controlAvailability.availableAfterSec)
      || currentBeat.controlAvailability.availableAfterSec < 0) {
      throw new Error(`${currentBeat.id} has invalid control availability timing`);
    }
    if (currentBeat.controlAvailability.mode === 'none' && currentBeat.controls.length !== 0) {
      throw new Error(`${currentBeat.id} exposes controls while availability mode is none`);
    }
    if (currentBeat.id === 'interaction'
      && (currentBeat.controlAvailability.mode !== 'guided-pause'
        || currentBeat.controlAvailability.availableAfterSec !== 0)) {
      throw new Error('interaction controls must be available during the guided pause');
    }
    if (currentBeat.id === 'interaction' && currentBeat.controls.some(control => control !== 'ue-drag')) {
      throw new Error('interaction only exposes the UE action; camera presets are not learner controls');
    }
    if (currentBeat.id === 'new-normal'
      && (currentBeat.controlAvailability.mode !== 'after-stable-hold'
        || currentBeat.controlAvailability.availableAfterSec !== currentBeat.playback.stableHoldSec
        || currentBeat.playback.stableHoldSec < 6)) {
      throw new Error('new-normal replay/next controls unlock only after the six-second stable hold');
    }
    if (currentBeat.id !== 'interaction' && currentBeat.id !== 'new-normal'
      && currentBeat.controlAvailability.mode !== 'none') {
      throw new Error(`${currentBeat.id} must expose no controls at any time`);
    }
    for (const surface of GOLDEN_FLOW_SURFACES) {
      if (!currentBeat.hiddenSurfaces.includes(surface)
        && visibleSurfaceForCue.get(currentBeat.primaryCue) !== surface) {
        throw new Error(`${currentBeat.id} leaves undeclared surface ${surface}`);
      }
    }
    if (currentBeat.guidance.mode === 'guided') {
      if (!currentBeat.guidance.predictionPrompt
        || !currentBeat.guidance.predictionEvidenceKey
        || !currentBeat.guidance.optionalGesture
        || currentBeat.guidance.optionalGesture.gestureLimit !== 1
        || currentBeat.learnerAction === null) {
        throw new Error('guided beat must declare prompt, one gesture, learner action and evidence keys');
      }
    } else if (currentBeat.guidance.predictionPrompt !== null
      || currentBeat.guidance.predictionEvidenceKey !== null
      || currentBeat.guidance.optionalGesture !== null
      || currentBeat.learnerAction !== null) {
      throw new Error(`${currentBeat.id} has guided-only fields despite autoplay mode`);
    }
    if (currentBeat.capture.screenshot !== 'required' || currentBeat.capture.status !== 'candidate-evidence') {
      throw new Error(`${currentBeat.id} capture status is not candidate evidence`);
    }
    if (currentBeat.truth.namespace === 'source-backed-handover') {
      const event = currentBeat.truth.sourceEvent;
      if (event === null
        || event.action !== 'inter-handover'
        || event.eventIdEvidence !== 'selection.logicalEventKey'
        || event.sourceSatelliteEvidence !== 'pair.from.satelliteId'
        || event.targetSatelliteEvidence !== 'pair.to.satelliteId'
        || event.offsetEvidence !== 'window.handoverPolicy.offsetDb'
        || event.tttEvidence !== 'window.handoverPolicy.tttSec'
        || JSON.stringify(event.traceEvidence) !== JSON.stringify(GOLDEN_FLOW_TRACE_EVIDENCE)
        || currentBeat.truth.evidenceIds.length < 4) {
        throw new Error(`${currentBeat.id} source-backed handover evidence is incomplete`);
      }
    } else if (currentBeat.truth.sourceEvent !== null) {
      throw new Error(`${currentBeat.id} joins a non-handover namespace to a source event`);
    }
  }

  const cueOrder: readonly GoldenFlowPrimaryCue[] = [
    'candidate-arrival', 'qualification-mark', 'ttt-ring', 'delta-trace', 'commit-pulse', 'event-receipt',
  ];
  const cueIndices = cueOrder.map(cue => beats.findIndex(currentBeat => currentBeat.primaryCue === cue));
  if (cueIndices.some(index => index < 0)
    || cueIndices.some((index, indexInOrder) => indexInOrder > 0 && index <= cueIndices[indexInOrder - 1]!)) {
    throw new Error('candidate/qualification/TTT/trace/commit/receipt cue order is invalid');
  }
  const trace = beats.find(currentBeat => currentBeat.id === 'trace')!;
  const commit = beats.find(currentBeat => currentBeat.id === 'commit')!;
  const traceEvidence = commit.truth.sourceEvent?.traceEvidence;
  if (trace.truth.evidenceIds.filter(id => id.includes('trace')).length < 1
    || traceEvidence === undefined
    || traceEvidence.expectedCount !== 2
    || JSON.stringify(traceEvidence.anchorEvidence)
      !== JSON.stringify(['qualification.anchors[0]', 'qualification.anchors[1]'])
    || traceEvidence.ordering !== 'strictly-increasing-anchor-index-and-instant'
    || traceEvidence.phase !== 'qualification-to-commit'
    || traceEvidence.connector !== 'none'
    || traceEvidence.digestEvidence !== 'selection.traceDigest') {
    throw new Error('trace evidence must bind exactly two ordered anchors without a connector');
  }
  if (commit.truth.sourceEvent?.action !== 'inter-handover'
    || commit.truth.sourceEvent.sourceSatelliteEvidence.length === 0
    || commit.truth.sourceEvent.targetSatelliteEvidence.length === 0
    || commit.truth.sourceEvent.eventIdEvidence !== 'selection.logicalEventKey'
    || commit.truth.sourceEvent.offsetEvidence !== 'window.handoverPolicy.offsetDb'
    || commit.truth.sourceEvent.tttEvidence !== 'window.handoverPolicy.tttSec') {
    throw new Error('commit requires inter-handover action and non-null source evidence');
  }
  const counterfactual = beats.filter(currentBeat => currentBeat.truth.namespace === 'teaching-counterfactual');
  if (counterfactual.length !== 2 || counterfactual.some(currentBeat => currentBeat.truth.sourceEvent !== null)) {
    throw new Error('counterfactual must remain a separate namespace with no handover join');
  }
  if (JSON.stringify(GOLDEN_FLOW_NAMESPACE_TRANSITIONS.map(transition => transition.beatId))
    !== JSON.stringify(['angles', 'interaction', 'restore', 'candidate'])) {
    throw new Error('namespace transitions are not explicit and ordered');
  }
  const interaction = beats.find(currentBeat => currentBeat.id === 'interaction')!;
  if (interaction.freeze.time !== 'frozen' || interaction.freeze.satellite !== 'fixed'
    || interaction.freeze.ue !== 'moving' || interaction.freeze.beamAxis !== 'source') {
    throw new Error('guided interaction does not freeze the controlled dimensions');
  }
  if (!GOLDEN_FLOW_COUNTERFACTUAL_BARRIER.fixedDimensions.includes('elevation')
    || GOLDEN_FLOW_COUNTERFACTUAL_BARRIER.mutableDimension !== 'ue-ground-position'
    || GOLDEN_FLOW_COUNTERFACTUAL_BARRIER.forbiddenPersistence.length !== 3) {
    throw new Error('counterfactual barrier is incomplete');
  }
  if (beats.some(currentBeat => currentBeat.causalExplanation.toLowerCase().includes('drag caused'))) {
    throw new Error('counterfactual explanation contains a causal join to handover');
  }
}

export interface GoldenFlowTruth {
  readonly constellation: 'starlink' | 'oneweb';
  readonly eventKind: 'inter-handover' | 'forced-continuity' | 'teaching-handover';
  readonly sourceSatelliteId: string;
  readonly sourceSatelliteName: string;
  readonly targetSatelliteId: string;
  readonly targetSatelliteName: string;
  readonly eventInstantUtc: string;
  readonly sourceSinrDb: number | null;
  readonly targetSinrDb: number | null;
  readonly deltaSinrDb: number | null;
  readonly offsetDb: number;
  readonly tttSec: number;
  readonly qualification: readonly { readonly instantUtc: string; readonly deltaDb: number; readonly progressSec: number }[];
  readonly servingElevationDeg: number;
  readonly servingRangeKm: number;
  readonly servingOffAxisDeg: number;
  readonly targetElevationDeg: number;
  readonly targetRangeKm: number;
  readonly provenanceLabel: string;
  readonly sourcePath: string;
  readonly sourceArchiveId: string;
  readonly sourceVisibleAtEvent: boolean;
  readonly targetVisibleAtEvent: boolean;
  readonly continuityReason: 'serving-lost-visibility' | null;
  readonly variantId: string;
  readonly sourceEventId: string;
  readonly sourceAction: 'inter-handover' | 'forced-continuity' | 'teaching-handover';
  readonly traceDigest: string;
  readonly offsetEvidenceId: string;
  readonly tttEvidenceId: string;
}

function loadStarlinkTeachingHandoverTruth(): GoldenFlowTruth {
  // The checked-in Starlink atlas currently contains no valid Offset+TTT event.
  // Act 4 therefore uses a plainly labelled controlled scenario to teach the
  // policy sequence.  These values are configuration, not archived telemetry.
  return Object.freeze({
    constellation: 'starlink',
    eventKind: 'teaching-handover',
    sourceSatelliteId: 'starlink-teaching-a',
    sourceSatelliteName: 'STARLINK A',
    targetSatelliteId: 'starlink-teaching-b',
    targetSatelliteName: 'STARLINK B',
    eventInstantUtc: '2026-08-25T12:06:00.000Z',
    sourceSinrDb: -8.2,
    targetSinrDb: -4.8,
    deltaSinrDb: 3.4,
    offsetDb: 3,
    tttSec: 30,
    qualification: Object.freeze([
      Object.freeze({ instantUtc: 'teaching+0s', deltaDb: 3.15, progressSec: 0 }),
      Object.freeze({ instantUtc: 'teaching+30s', deltaDb: 3.4, progressSec: 30 }),
    ]),
    servingElevationDeg: 35,
    servingRangeKm: 750,
    servingOffAxisDeg: 0.8,
    targetElevationDeg: 58,
    targetRangeKm: 620,
    provenanceLabel: 'Starlink 受控教學情境・3 dB 閾值・30 秒 TTT',
    sourcePath: 'teaching://starlink-walker-handover',
    sourceArchiveId: 'configured-teaching-scenario-v1',
    sourceVisibleAtEvent: true,
    targetVisibleAtEvent: true,
    continuityReason: null,
    variantId: 'starlink-controlled-offset-ttt-v1',
    sourceEventId: 'starlink-controlled-handover-v1',
    sourceAction: 'teaching-handover',
    traceDigest: 'teaching-threshold-ttt-sequence-v1',
    offsetEvidenceId: 'teaching-policy.offsetDb',
    tttEvidenceId: 'teaching-policy.tttSec',
  });
}

export function loadGoldenFlowTruth(constellation: 'starlink' | 'oneweb' = 'starlink'): GoldenFlowTruth {
  if (constellation === 'starlink') return loadStarlinkTeachingHandoverTruth();
  const fixture = loadSixActsTeachingWindow();
  const before = fixture.atlasForecast.samples.find(sample => sample.role === 'before');
  if (before?.serving === null || before?.serving === undefined
    || before.candidate === null || before.candidate === undefined) {
    throw new Error('The pinned teaching window has no complete before-event geometry.');
  }
  const [firstAnchor, secondAnchor] = fixture.qualification.anchors;
  if (fixture.qualification.anchors.length !== GOLDEN_FLOW_TRACE_EVIDENCE.expectedCount
    || firstAnchor === undefined
    || secondAnchor === undefined
    || secondAnchor.anchorIndex <= firstAnchor.anchorIndex
    || secondAnchor.progressSec <= firstAnchor.progressSec) {
    throw new Error('The pinned teaching window must expose exactly two strictly ordered qualification anchors.');
  }
  const firstAnchorMs = Date.parse(firstAnchor.instantUtc);
  const secondAnchorMs = Date.parse(secondAnchor.instantUtc);
  if (!Number.isFinite(firstAnchorMs) || !Number.isFinite(secondAnchorMs)
    || secondAnchorMs <= firstAnchorMs) {
    throw new Error('The pinned qualification anchors must have strictly increasing UTC instants.');
  }
  if (fixture.selection.traceDigest.trim().length === 0) {
    throw new Error('The pinned teaching window has no trace digest.');
  }
  if (fixture.selection.logicalEventKey.trim().length === 0
    || fixture.selection.sourceEvent !== 'inter-handover'
    || fixture.pair.from.satelliteId.trim().length === 0
    || fixture.pair.to.satelliteId.trim().length === 0
    || !Number.isFinite(fixture.window.handoverPolicy.offsetDb)
    || !Number.isFinite(fixture.window.handoverPolicy.tttSec)) {
    throw new Error('The pinned teaching window has incomplete inter-handover locators.');
  }

  return Object.freeze({
    constellation: 'oneweb',
    eventKind: 'inter-handover',
    sourceSatelliteId: fixture.pair.from.satelliteId,
    sourceSatelliteName: fixture.pair.from.satelliteName,
    targetSatelliteId: fixture.pair.to.satelliteId,
    targetSatelliteName: fixture.pair.to.satelliteName,
    eventInstantUtc: fixture.window.triggerInstantUtc,
    sourceSinrDb: fixture.qualification.preCommit.servingSinrDb,
    targetSinrDb: fixture.qualification.preCommit.candidateSinrDb,
    deltaSinrDb: fixture.qualification.preCommit.deltaDb,
    offsetDb: fixture.window.handoverPolicy.offsetDb,
    tttSec: fixture.window.handoverPolicy.tttSec,
    qualification: Object.freeze(fixture.qualification.anchors.map(anchor => Object.freeze({ ...anchor }))),
    servingElevationDeg: before.serving.elevationDeg,
    servingRangeKm: before.serving.rangeKm,
    servingOffAxisDeg: before.serving.offAxisAngleRad * 180 / Math.PI,
    targetElevationDeg: before.candidate.elevationDeg,
    targetRangeKm: before.candidate.rangeKm,
    provenanceLabel: 'OneWeb 歸檔 TLE・SGP4 事件錨點・30 秒來源錨點',
    sourcePath: fixture.pair.from.sourcePath,
    sourceArchiveId: 'oneweb-filesystem-archive-v1',
    sourceVisibleAtEvent: before.serving.elevationDeg >= 0,
    targetVisibleAtEvent: before.candidate.elevationDeg >= 0,
    continuityReason: null,
    variantId: fixture.selection.variantId,
    sourceEventId: fixture.selection.logicalEventKey,
    sourceAction: fixture.selection.sourceEvent,
    traceDigest: fixture.selection.traceDigest,
    offsetEvidenceId: 'window.handoverPolicy.offsetDb',
    tttEvidenceId: 'window.handoverPolicy.tttSec',
  });
}

export function goldenFlowBeatIndex(value: string | null): number | null {
  if (value === null) return null;
  const index = GOLDEN_FLOW_BEATS.findIndex(currentBeat => currentBeat.id === value);
  return index < 0 ? null : index;
}

assertGoldenFlowContract();
