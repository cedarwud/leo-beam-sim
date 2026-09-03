import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import {
  GLOBAL_CONSTELLATION_BEATS,
  GLOBAL_CONSTELLATION_COLOURS,
  GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC,
  GLOBAL_CONSTELLATION_FACTS,
  GLOBAL_CONSTELLATION_POINT_MARKER_SIZE,
  GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC,
  GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
  GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC,
  GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC,
  GLOBAL_CONSTELLATION_PLAYBACK_SPEEDS,
  beatToCourseTime,
  courseTimeToBeat,
  globalConstellationDisplayedConstellation,
  globalConstellationReviewFrameCourseTime,
  globalConstellationInteractionStateForCourseTime,
  globalConstellationBeatIndex,
  globalConstellationChromePhase,
  globalConstellationChromeState,
  resolveGlobalConstellationPlayRequest,
  type GlobalConstellationBeat,
  type GlobalConstellationBeatId,
  type GlobalConstellationChromeId,
  type GlobalConstellationChromePhase,
} from './globalConstellationDirector';
import type { GlobalConstellationCameraTelemetry } from './globalConstellationCamera';
import { GlobalConstellationScene } from './GlobalConstellationScene';
import { ntpuVisibilityMask } from './globalConstellationGeometry';
import {
  TeachingAnimationTransport,
  type PlaybackSpeed,
} from '../../course/transport';
import { SixActsNav } from '../../course/nav/SixActsNav';
import { isSixActsLightCaptureMode } from '../../course/nav/lightCapture';
import {
  visualLabGlobalConstellationStore,
  type VisualLabGlobalConstellationFirstFrameState,
} from '../../visualLab/globalConstellation';
import './GlobalConstellationPrototype.scss';

type ConstellationState = Readonly<{
  readonly starlink: VisualLabGlobalConstellationFirstFrameState;
  readonly oneweb: VisualLabGlobalConstellationFirstFrameState;
}>;

type ConstellationId = 'starlink' | 'oneweb';

function initialConstellationState(): ConstellationState {
  return {
    starlink: visualLabGlobalConstellationStore.state('starlink'),
    oneweb: visualLabGlobalConstellationStore.state('oneweb'),
  };
}

function useConstellationArtifacts(): ConstellationState {
  const [states, setStates] = useState<ConstellationState>(initialConstellationState);
  useEffect(() => {
    let mounted = true;
    const unsubscribe = visualLabGlobalConstellationStore.subscribe((next) => {
      if (!mounted) return;
      setStates(previous => ({ ...previous, [next.constellation]: next }));
    });
    void Promise.all([
      visualLabGlobalConstellationStore.load('starlink'),
      visualLabGlobalConstellationStore.load('oneweb'),
    ]);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  return states;
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return reducedMotion;
}

function ease(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function requestedBeatFromUrl(): number | null {
  if (typeof window === 'undefined') return null;
  return globalConstellationBeatIndex(new URLSearchParams(window.location.search).get('beat'));
}

function beatProgress(elapsedSec: number, beat: GlobalConstellationBeat): number {
  return Math.max(0, Math.min(1, elapsedSec / beat.durationSec));
}

function cameraTelemetryEqual(
  previous: GlobalConstellationCameraTelemetry,
  next: GlobalConstellationCameraTelemetry,
): boolean {
  return previous.pose === next.pose
    && previous.settled === next.settled
    && previous.positionErrorWorld === next.positionErrorWorld
    && previous.targetErrorWorld === next.targetErrorWorld
    && previous.settledFrames === next.settledFrames;
}

interface ChromeProps {
  readonly id: GlobalConstellationChromeId;
  readonly phase: GlobalConstellationChromePhase;
  readonly className: string;
  readonly cluster: 'edge' | 'subtitle' | 'top' | 'control';
  readonly children: ReactNode;
  readonly testId?: string;
  readonly extraAttributes?: Readonly<Record<string, string>>;
}

/**
 * One compositor primitive for all teaching chrome. It returns no DOM in the
 * hidden phase, keeping the stage a scene rather than a dashboard of empty
 * cards waiting on top of it.
 */
function DirectorChrome({
  id,
  phase,
  className,
  cluster,
  children,
  testId,
  extraAttributes,
}: ChromeProps): ReactElement | null {
  if (phase === 'hidden') return null;
  return (
    <div
      className={`global-constellation-chrome ${className} is-${phase}`}
      data-stage-occluder="true"
      data-chrome-id={id}
      data-chrome-phase={phase}
      data-chrome-cluster={cluster}
      data-testid={testId}
      {...extraAttributes}
    >
      {children}
    </div>
  );
}

function StoryTitle({ beat, elapsedSec }: { readonly beat: GlobalConstellationBeat; readonly elapsedSec: number }): ReactElement | null {
  const phase = globalConstellationChromePhase(beat.id, 'title', elapsedSec);
  return (
    <DirectorChrome id="title" phase={phase} className="global-constellation-title" cluster="top">
      <span className="global-constellation-title__eyebrow">GLOBAL CONSTELLATIONS</span>
      <strong>數量 × 高度 × 幾何可見性</strong>
    </DirectorChrome>
  );
}

function BeatCounter({ beat }: { readonly beat: GlobalConstellationBeat }): ReactElement {
  return (
    <div
      className={`global-constellation-beat-counter${beat.id === 'earth-question' ? ' is-with-title' : ''}`}
      data-stage-occluder="true"
      data-chrome-id="beat-counter"
      data-chrome-phase="hold"
      data-chrome-cluster="top"
      data-beat-counter="true"
      data-beat-counter-index={String(beat.order)}
      data-beat-counter-total={String(GLOBAL_CONSTELLATION_BEATS.length)}
      data-testid="global-constellation-beat-counter"
      aria-label={`第 ${beat.order} 段，共 ${GLOBAL_CONSTELLATION_BEATS.length} 段`}
    >
      <span>段落</span>
      <strong>{String(beat.order).padStart(2, '0')} / {String(GLOBAL_CONSTELLATION_BEATS.length).padStart(2, '0')}</strong>
    </div>
  );
}

function TruthCue({ beat, elapsedSec }: { readonly beat: GlobalConstellationBeat; readonly elapsedSec: number }): ReactElement | null {
  const phase = globalConstellationChromePhase(beat.id, 'truth', elapsedSec);
  return (
    <DirectorChrome
      id="truth"
      phase={phase}
      className="global-constellation-truth-cue"
      cluster="top"
      testId="global-constellation-truth-cue"
      extraAttributes={{ 'data-truth-cue': 'count-and-point-size' }}
    >
      <span data-truth-line="true">2026-08-25 · UTC 12:00</span>
      <span data-truth-line="true">封存 TLE→SGP4 · 標記非實體尺寸</span>
    </DirectorChrome>
  );
}

function ConstellationSelector({
  beat,
  selected,
  comparisonViewed,
  onSelect,
}: {
  readonly beat: GlobalConstellationBeat;
  readonly selected: ConstellationId;
  readonly comparisonViewed: boolean;
  readonly onSelect: (constellation: ConstellationId) => void;
}): ReactElement | null {
  if (beat.id !== 'oneweb-compare') return null;
  return (
    <aside
      className="global-constellation-selector"
      data-stage-occluder="true"
      data-chrome-cluster="edge"
      data-testid="global-constellation-selector"
      aria-label="星座顯示切換"
    >
      <div className="global-constellation-selector__heading">
        <span>單一星座檢視</span>
        <small>{comparisonViewed ? '可繼續播放' : '請切至 OneWeb 後繼續'}</small>
      </div>
      <div role="group" aria-label="選擇畫面中的星座">
        {(['starlink', 'oneweb'] as const).map(constellation => (
          <button
            key={constellation}
            type="button"
            data-constellation={constellation}
            aria-pressed={selected === constellation}
            onClick={() => onSelect(constellation)}
          >
            {constellation === 'starlink' ? 'Starlink' : 'OneWeb'}
          </button>
        ))}
      </div>
      <small>畫面一次僅顯示一個星座</small>
    </aside>
  );
}

interface EdgeNumberProps {
  readonly phase: GlobalConstellationChromePhase;
  readonly side: 'left' | 'right';
  readonly tone: 'starlink' | 'oneweb';
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

function EdgeNumber({ phase, side, tone, label, value, detail }: EdgeNumberProps): ReactElement | null {
  return (
    <DirectorChrome
      id="edge-number"
      phase={phase}
      className={`global-constellation-edge-number global-constellation-edge-number--${side} is-${tone}`}
      cluster="edge"
      extraAttributes={{ 'data-short-number': 'true', 'data-chrome-role': 'text-only-edge-number' }}
    >
      <span className="global-constellation-edge-number__label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </DirectorChrome>
  );
}

function EdgeNumbers({
  beat,
  elapsedSec,
  selected,
  ntpuVisibleCounts,
}: {
  readonly beat: GlobalConstellationBeat;
  readonly elapsedSec: number;
  readonly selected: ConstellationId;
  readonly ntpuVisibleCounts: Readonly<Record<ConstellationId, number>>;
}): ReactElement | null {
  const phase = globalConstellationChromePhase(beat.id, 'edge-number', elapsedSec);
  if (phase === 'hidden') return null;
  const starlink = GLOBAL_CONSTELLATION_FACTS.starlink;
  const oneweb = GLOBAL_CONSTELLATION_FACTS.oneweb;
  if (beat.id === 'starlink-density') {
    return <EdgeNumber phase={phase} side="left" tone="starlink" label="STARLINK" value={formatCount(starlink.count)} detail="封存定位 · 全球點雲" />;
  }
  if (beat.id === 'oneweb-compare') {
    const fact = selected === 'starlink' ? starlink : oneweb;
    return <EdgeNumber phase={phase} side="left" tone={selected} label={fact.label.toUpperCase()} value={formatCount(fact.count)} detail="封存定位 · 單一星座" />;
  }
  if (beat.id === 'starlink-visible') {
    return <EdgeNumber phase={phase} side="left" tone="starlink" label="NTPU · α ≥ 10°" value={formatCount(ntpuVisibleCounts.starlink)} detail="Starlink · 觀測門檻" />;
  }
  if (beat.id === 'oneweb-visible') {
    return <EdgeNumber phase={phase} side="left" tone="oneweb" label="NTPU · α ≥ 10°" value={formatCount(ntpuVisibleCounts.oneweb)} detail="OneWeb · 觀測門檻" />;
  }
  return null;
}

function Caption({
  beat,
  elapsedSec,
  selected,
}: {
  readonly beat: GlobalConstellationBeat;
  readonly elapsedSec: number;
  readonly selected: ConstellationId;
}): ReactElement | null {
  const phase = globalConstellationChromePhase(beat.id, 'caption', elapsedSec);
  const caption = beat.id === 'oneweb-compare' && selected === 'starlink'
    ? [
      'Starlink：封存快照記錄 10,738 顆成功定位。',
      '請切換至 OneWeb，再於相同尺度下讀取數量與高度。',
    ] as const
    : beat.caption;
  return (
    <DirectorChrome
      id="caption"
      phase={phase}
      className="global-constellation-caption"
      cluster="subtitle"
      testId="global-constellation-caption"
      extraAttributes={{
        'data-chrome-role': 'text-only-subtitle',
        'data-subtitle-lines': String(caption.filter(line => line !== undefined).length),
        'data-caption-constellation': beat.id === 'oneweb-compare' ? selected : 'authored',
      }}
    >
      {caption.map((line, index) => line === undefined ? null : (
        <span key={index} data-caption-line="true">{line}</span>
      ))}
    </DirectorChrome>
  );
}

function RevealControl({
  beat,
  elapsedSec,
  interactionRevealed,
  onReveal,
}: {
  readonly beat: GlobalConstellationBeat;
  readonly elapsedSec: number;
  readonly interactionRevealed: boolean;
  readonly onReveal: () => void;
}): ReactElement | null {
  const phase = globalConstellationChromePhase(beat.id, 'reveal', elapsedSec);
  return (
    <DirectorChrome id="reveal" phase={phase} className="global-constellation-edge-control global-constellation-edge-control--reveal" cluster="control">
      <span>下一步：請按下左側按鈕，顯示依公式計算的幾何可見衛星</span>
      <button
        type="button"
        data-testid="global-constellation-reveal"
        data-control-id="reveal-ntpu"
        onClick={onReveal}
        disabled={interactionRevealed}
      >
        {interactionRevealed ? '結果已顯示' : '顯示幾何可見衛星'}
      </button>
    </DirectorChrome>
  );
}

function FinaleChrome({
  beat,
  elapsedSec,
  onReplay,
}: {
  readonly beat: GlobalConstellationBeat;
  readonly elapsedSec: number;
  readonly onReplay: () => void;
}): ReactElement | null {
  const copyPhase = globalConstellationChromePhase(beat.id, 'finale-copy', elapsedSec);
  const replayPhase = globalConstellationChromePhase(beat.id, 'replay', elapsedSec);
  return (
    <>
      <DirectorChrome
        id="finale-copy"
        phase={copyPhase}
        className="global-constellation-finale-copy"
        cluster="subtitle"
        testId="global-constellation-finale-copy"
        extraAttributes={{ 'data-chrome-role': 'text-only-subtitle', 'data-subtitle-lines': '1' }}
      >
        <div data-final-bridge-copy="true">
          <span>按播放或「重新播放」，都會從第一個畫面開始。</span>
        </div>
      </DirectorChrome>
      <DirectorChrome id="replay" phase={replayPhase} className="global-constellation-finale-control global-constellation-finale-control--replay" cluster="control">
        <button type="button" data-control-id="replay" onClick={onReplay}>重新播放</button>
        <a href="/course/tle-journey" data-control-id="next" aria-label="下一幕：星曆與通聯預測">下一幕</a>
      </DirectorChrome>
    </>
  );
}

function LoadingStage({ states }: { readonly states: ConstellationState }): ReactElement {
  const errors = [states.starlink, states.oneweb]
    .filter((state): state is Extract<VisualLabGlobalConstellationFirstFrameState, { status: 'error' }> => state.status === 'error')
    .map(state => `${state.constellation}: ${state.error}`);
  return (
    <div className="global-constellation-loading" role={errors.length > 0 ? 'alert' : 'status'}>
      <span className="global-constellation-loading__orb" aria-hidden="true" />
      <strong>{errors.length > 0 ? '封存全球資料無法載入' : '正在載入封存星座資料…'}</strong>
      <small>{errors.length > 0 ? errors.join(' · ') : '等待已驗證資料；不以合成資料或即時來源替代。'}</small>
    </div>
  );
}

function MobileHeightLabels({ beat }: { readonly beat: GlobalConstellationBeat }): ReactElement | null {
  if (beat.id !== 'height-cross-section') return null;
  return (
    <div
      className="global-constellation-mobile-height-labels"
      data-stage-occluder="true"
      data-chrome-id="height-labels"
      data-chrome-role="text-only-mobile-height-labels"
      data-chrome-phase="hold"
      data-chrome-cluster="edge"
      aria-label="中位高度導引標籤"
    >
      <span data-mobile-height-guide="starlink">Starlink · 481 km</span>
      <span data-mobile-height-guide="oneweb">OneWeb · 1,212 km</span>
    </div>
  );
}

export function GlobalConstellationPrototype(): ReactElement {
  const lightCapture = isSixActsLightCaptureMode();
  const states = useConstellationArtifacts();
  const reducedMotion = useReducedMotion();
  const requestedBeat = useMemo(requestedBeatFromUrl, []);
  const initialBeatIndex = requestedBeat ?? 0;
  const reviewMode = requestedBeat !== null;
  const initialCourseTimeSec = reviewMode
    ? globalConstellationReviewFrameCourseTime(initialBeatIndex)
    : beatToCourseTime(0, 0);

  const [isPlaying, setIsPlaying] = useState(!reviewMode);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [courseTimeSec, setCourseTimeSec] = useState(() => initialCourseTimeSec);
  const [selectedConstellation, setSelectedConstellation] = useState<ConstellationId>('starlink');
  const [comparisonViewed, setComparisonViewed] = useState(
    () => initialCourseTimeSec > GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC,
  );
  const [cameraTelemetry, setCameraTelemetry] = useState<GlobalConstellationCameraTelemetry>(() => ({
    pose: (GLOBAL_CONSTELLATION_BEATS[initialBeatIndex] ?? GLOBAL_CONSTELLATION_BEATS[0]!).camera,
    settled: false,
    positionErrorWorld: Number.POSITIVE_INFINITY,
    targetErrorWorld: Number.POSITIVE_INFINITY,
    settledFrames: 0,
  }));

  const lastNowRef = useRef<number | null>(null);
  const courseTimeRef = useRef(courseTimeSec);
  const isPlayingRef = useRef(isPlaying);
  const playbackSpeedRef = useRef(playbackSpeed);
  const comparisonViewedRef = useRef(comparisonViewed);
  courseTimeRef.current = courseTimeSec;
  isPlayingRef.current = isPlaying;
  playbackSpeedRef.current = playbackSpeed;
  comparisonViewedRef.current = comparisonViewed;

  const { beatIndex, beat, elapsedSec } = useMemo(() => {
    const res = courseTimeToBeat(courseTimeSec);
    return {
      beatIndex: res.beatIndex,
      beat: res.beat,
      elapsedSec: res.beatElapsedSec,
    };
  }, [courseTimeSec]);

  const reportCameraTelemetry = useCallback((telemetry: GlobalConstellationCameraTelemetry) => {
    setCameraTelemetry(previous => cameraTelemetryEqual(previous, telemetry) ? previous : telemetry);
  }, []);

  useEffect(() => {
    setCameraTelemetry({
      pose: beat.camera,
      settled: false,
      positionErrorWorld: Number.POSITIVE_INFINITY,
      targetErrorWorld: Number.POSITIVE_INFINITY,
      settledFrames: 0,
    });
  }, [beat.camera]);

  // The interaction checkpoint is a pure projection of the one course clock,
  // not a second state machine synchronized from the RAF.  Rewind, seek, and
  // replay therefore cannot create a second React update at the same tick.
  const interactionRevealed = globalConstellationInteractionStateForCourseTime(courseTimeSec) === 'completed';

  const commitCourseTime = useCallback((nextCourseTimeSec: number) => {
    if (courseTimeRef.current === nextCourseTimeSec) return;
    courseTimeRef.current = nextCourseTimeSec;
    setCourseTimeSec(nextCourseTimeSec);
  }, []);

  const setPlaying = useCallback((nextPlaying: boolean) => {
    if (isPlayingRef.current === nextPlaying) return;
    isPlayingRef.current = nextPlaying;
    setIsPlaying(nextPlaying);
  }, []);

  const commitComparisonViewed = useCallback((nextViewed: boolean) => {
    comparisonViewedRef.current = nextViewed;
    setComparisonViewed(nextViewed);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isPlayingRef.current) {
      setPlaying(false);
      return;
    }
    if (courseTimeRef.current >= GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC) {
      const request = resolveGlobalConstellationPlayRequest(courseTimeRef.current, interactionRevealed);
      setSelectedConstellation('starlink');
      commitComparisonViewed(false);
      commitCourseTime(request.nextCourseTimeSec);
      setPlaying(request.shouldPlay);
      return;
    }
    // Natural playback pauses before the first OneWeb frame. The viewer must
    // explicitly switch the single-cloud scene once before playback can resume.
    if (!comparisonViewedRef.current
      && courseTimeRef.current >= GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC) return;
    // Play cannot bypass the local reveal checkpoint.  The learner must
    // activate the reveal control before the next beat can be entered.
    if (!interactionRevealed && courseTimeRef.current >= GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC) return;
    setPlaying(true);
  }, [commitComparisonViewed, commitCourseTime, interactionRevealed, setPlaying]);

  const handleSeek = useCallback((timeSec: number) => {
    const target = Math.max(0, Math.min(GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC, timeSec));
    commitComparisonViewed(target > GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC);
    if (target <= GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC) {
      setSelectedConstellation('starlink');
    }
    commitCourseTime(target);
    setPlaying(false);
  }, [commitComparisonViewed, commitCourseTime, setPlaying]);

  const handleStepBackward = useCallback((stepSec = 5) => {
    handleSeek(Math.max(0, courseTimeRef.current - stepSec));
  }, [handleSeek]);

  const handleStepForward = useCallback((stepSec = 5) => {
    handleSeek(Math.min(GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC, courseTimeRef.current + stepSec));
  }, [handleSeek]);

  const handleSpeedChange = useCallback((speed: PlaybackSpeed) => {
    setPlaybackSpeed(speed);
  }, []);

  const replay = useCallback(() => {
    setSelectedConstellation('starlink');
    commitComparisonViewed(false);
    commitCourseTime(0);
    setPlaying(true);
  }, [commitComparisonViewed, commitCourseTime, setPlaying]);

  const selectConstellation = useCallback((constellation: ConstellationId) => {
    setSelectedConstellation(constellation);
    if (constellation === 'oneweb') {
      commitComparisonViewed(true);
      // The natural checkpoint owns elapsed=0, before timed captions/counts
      // enter. Advance only the presentation clock to its readable hold frame
      // while keeping playback paused for manual comparison.
      if (courseTimeRef.current === GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC) {
        commitCourseTime(GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC + 0.45);
      }
    }
    setPlaying(false);
  }, [commitComparisonViewed, commitCourseTime, setPlaying]);

  const revealNtpU = useCallback(() => {
    commitCourseTime(GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC);
    setPlaying(true);
  }, [commitCourseTime, setPlaying]);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const previousNow = lastNowRef.current;
      const rawDt = previousNow === null ? 0 : Math.max(0, (now - previousNow) / 1000);
      const dt = document.visibilityState === 'hidden' ? Math.min(0.1, rawDt) : rawDt;
      lastNowRef.current = now;

      if (isPlayingRef.current && dt > 0) {
        const current = courseTimeRef.current;
        const comparisonCheckpointReached = !comparisonViewedRef.current
          && current >= GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC;
        const interactionComplete = current >= GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC;
        const checkpointReached = !interactionComplete
          && current >= GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC;
        const durationReached = current >= GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC;
        if (comparisonCheckpointReached || checkpointReached || durationReached) {
          setPlaying(false);
        } else {
          const candidate = Math.min(
            GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC,
            current + dt * playbackSpeedRef.current,
          );
          const next = !comparisonViewedRef.current
            && candidate >= GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC
            ? GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC
            : !interactionComplete && candidate >= GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC
              ? GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC
              : candidate;
          const shouldPause = next >= GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC
            || (!comparisonViewedRef.current
              && next >= GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC)
            || (!interactionComplete && next >= GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC);
          if (next !== current) commitCourseTime(next);
          if (shouldPause) setPlaying(false);
        }
      }

      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      lastNowRef.current = null;
    };
  }, [commitCourseTime, setPlaying]);

  const artifactsReady = states.starlink.status === 'ready' && states.oneweb.status === 'ready';
  const starlink = states.starlink.status === 'ready' ? states.starlink.artifact : null;
  const oneweb = states.oneweb.status === 'ready' ? states.oneweb.artifact : null;
  const starlinkNtpuVisibility = useMemo(
    () => starlink === null
      ? null
      : ntpuVisibilityMask(
        starlink.positionsWorld,
        GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
      ),
    [starlink],
  );
  const onewebNtpuVisibility = useMemo(
    () => oneweb === null
      ? null
      : ntpuVisibilityMask(
        oneweb.positionsWorld,
        GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
      ),
    [oneweb],
  );
  const progress = beatProgress(elapsedSec, beat);
  const displayedConstellation = globalConstellationDisplayedConstellation(beat.id, selectedConstellation);
  const sceneConstellation = beat.id === 'ntpu-reveal' && !interactionRevealed
    ? 'none'
    : displayedConstellation;
  const starlinkReveal = sceneConstellation !== 'starlink'
    ? 0
    : beat.id === 'starlink-density'
      ? ease(progress * 1.25)
      : 1;
  const onewebReveal = sceneConstellation === 'oneweb' ? 1 : 0;
  const showHeightGuides = beat.id === 'height-cross-section';
  const showHeightLabels = beat.id === 'height-cross-section';
  const visibility = beat.id === 'starlink-visible'
    ? 'starlink'
    : beat.id === 'oneweb-visible'
      ? 'oneweb'
      : beat.id === 'stable-finale'
        ? sceneConstellation === 'none' ? 'none' : sceneConstellation
        : 'none';
  const ntpuActive = beatIndex >= 4;
  const chromeStates = useMemo(() => globalConstellationChromeState(beat.id, elapsedSec), [beat.id, elapsedSec]);
  const visibleChromeIds = chromeStates.filter(state => state.visible).map(state => state.id);
  const chromeHold = chromeStates.some(state => state.phase === 'hold');
  const visibleControls = beat.id === 'ntpu-reveal'
    ? 'reveal-ntpu'
    : beat.id === 'oneweb-compare'
      ? 'select-starlink,select-oneweb'
      : beat.id === 'stable-finale' ? 'replay' : '';
  const stageReady = artifactsReady
    && starlink !== null
    && oneweb !== null
    && starlinkNtpuVisibility !== null
    && onewebNtpuVisibility !== null;

  const currentEffectiveCourseTime = courseTimeSec;

  const dataAttrs = {
    'data-beat': beat.id,
    'data-beat-order': String(beat.order),
    'data-camera-pose': beat.camera,
    'data-primary-cue': beat.primaryCue,
    'data-visible-controls': visibleControls,
    'data-visible-chrome': visibleChromeIds.join(','),
    'data-chrome-hold': chromeHold ? 'true' : 'false',
    'data-autoplay-paused': (!isPlaying
      || (beat.id === 'oneweb-compare' && !comparisonViewed)
      || (beat.id === 'ntpu-reveal' && !interactionRevealed)) ? 'true' : 'false',
    'data-comparison-state': comparisonViewed ? 'completed' : 'awaiting-oneweb',
    'data-selected-constellation': selectedConstellation,
    'data-displayed-constellation': sceneConstellation,
    'data-interaction-state': beat.id === 'ntpu-reveal' ? (interactionRevealed ? 'completed' : 'awaiting-reveal') : 'not-available',
    'data-reveal-interaction-state': interactionRevealed ? 'completed' : 'awaiting-reveal',
    'data-render-mode': 'archived-tle-sgp4-first-frame-display',
    'data-fixed-instant': GLOBAL_CONSTELLATION_FACTS.instantUtc,
    'data-world-frame': GLOBAL_CONSTELLATION_FACTS.worldFrame,
    'data-truth-boundary': '封存 TLE 經 SGP4 定位；NTPU 站心座標以 α = atan2(U, √(E²+N²)) ≥ 10° 列入課程觀測範圍；不是服務覆蓋、非即時遙測、非鏈路品質',
    'data-ntpu-minimum-elevation-deg': String(GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG),
    'data-artifacts-ready': stageReady ? 'true' : 'false',
    'data-artifact-starlink-count': starlink?.satelliteCount ?? '',
    'data-artifact-oneweb-count': oneweb?.satelliteCount ?? '',
    'data-artifact-starlink-visible': starlink?.ntpuVisibleSatelliteCount ?? '',
    'data-artifact-oneweb-visible': oneweb?.ntpuVisibleSatelliteCount ?? '',
    'data-ntpu-starlink-visible': starlinkNtpuVisibility?.visibleCount ?? '',
    'data-ntpu-oneweb-visible': onewebNtpuVisibility?.visibleCount ?? '',
    'data-artifact-starlink-snapshot': starlink?.snapshotPath ?? '',
    'data-artifact-oneweb-snapshot': oneweb?.snapshotPath ?? '',
    'data-artifact-starlink-sha256': starlink?.snapshotSha256 ?? '',
    'data-artifact-oneweb-sha256': oneweb?.snapshotSha256 ?? '',
    'data-encoding-starlink': GLOBAL_CONSTELLATION_COLOURS.starlink,
    'data-encoding-oneweb': GLOBAL_CONSTELLATION_COLOURS.oneweb,
    'data-point-marker-size': String(GLOBAL_CONSTELLATION_POINT_MARKER_SIZE),
    'data-orbit-boundary-overlay': 'none',
    'data-point-cloud-starlink': sceneConstellation === 'starlink' && starlinkReveal > 0.01 ? 'visible' : 'hidden',
    'data-point-cloud-oneweb': sceneConstellation === 'oneweb' && onewebReveal > 0.01 ? 'visible' : 'hidden',
    'data-height-guides': showHeightGuides ? 'visible' : 'hidden',
    'data-height-labels': showHeightLabels ? 'visible' : 'hidden',
    'data-visibility-mask': visibility,
    'data-visible-only': visibility === 'none' ? 'false' : 'true',
    'data-rendered-point-count': visibility === 'starlink'
      ? String(starlinkNtpuVisibility?.visibleCount ?? '')
      : visibility === 'oneweb'
        ? String(onewebNtpuVisibility?.visibleCount ?? '')
        : sceneConstellation === 'starlink'
          ? String(starlink?.satelliteCount ?? '')
          : sceneConstellation === 'oneweb'
            ? String(oneweb?.satelliteCount ?? '')
            : '0',
    'data-focus-target': beat.focusTarget,
    'data-focus-reticle': beat.focusTarget === 'ntpu-local' && beat.id !== 'stable-finale' ? 'visible' : 'hidden',
    'data-camera-settled': cameraTelemetry.pose === beat.camera && cameraTelemetry.settled ? 'true' : 'false',
    'data-camera-position-error': String(cameraTelemetry.positionErrorWorld),
    'data-camera-target-error': String(cameraTelemetry.targetErrorWorld),
    'data-camera-settled-frames': String(cameraTelemetry.settledFrames),
    'data-final-motion': beat.id === 'stable-finale' ? 'frozen' : 'active',
    'data-finale-link-result': beat.id === 'stable-finale' ? 'none' : 'not-applicable',
    'data-camera-director': 'automatic',
    'data-camera-interaction': isPlaying ? 'director-locked' : 'orbit-enabled',
    'data-stage-layout': 'full-viewport-single-stage',
    'data-transport-playing': isPlaying ? 'true' : 'false',
    'data-transport-speed': String(playbackSpeed),
    'data-transport-time': currentEffectiveCourseTime.toFixed(1),
    'data-transport-duration': String(GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC),
  } as const;

  return (
    <main
      {...dataAttrs}
      className="global-constellation-story"
      lang="zh-Hant"
      data-theme={lightCapture ? 'light-capture' : undefined}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
    >
      <section className="global-constellation-stage" data-testid="global-constellation-stage" aria-label="Starlink 與 OneWeb 全球星座教學舞台">
        <SixActsNav currentHref="/prototype/global-constellation" variant="stage" />
        {stageReady ? (
          <GlobalConstellationScene
            starlink={starlink}
            oneweb={oneweb}
            starlinkVisibilityMask={starlinkNtpuVisibility.mask}
            onewebVisibilityMask={onewebNtpuVisibility.mask}
            cameraPose={beat.camera}
            starlinkReveal={starlinkReveal}
            onewebReveal={onewebReveal}
            showHeightGuides={showHeightGuides}
            showHeightLabels={showHeightLabels}
            displayedConstellation={sceneConstellation}
            visibility={visibility}
            ntpuActive={ntpuActive}
            showElevationGeometry={beat.focusTarget === 'ntpu-local' && interactionRevealed}
            focusTarget={beat.focusTarget}
            reducedMotion={reducedMotion}
            isPlaying={isPlaying}
            onTogglePlayback={handlePlayPause}
            onCameraTelemetry={reportCameraTelemetry}
            lightCapture={lightCapture}
          />
        ) : <LoadingStage states={states} />}

        <BeatCounter beat={beat} />
        <MobileHeightLabels beat={beat} />
        <StoryTitle beat={beat} elapsedSec={elapsedSec} />
        <TruthCue beat={beat} elapsedSec={elapsedSec} />
        <ConstellationSelector
          beat={beat}
          selected={selectedConstellation}
          comparisonViewed={comparisonViewed}
          onSelect={selectConstellation}
        />
        <EdgeNumbers
          beat={beat}
          elapsedSec={elapsedSec}
          selected={selectedConstellation}
          ntpuVisibleCounts={{
            starlink: starlinkNtpuVisibility?.visibleCount ?? 0,
            oneweb: onewebNtpuVisibility?.visibleCount ?? 0,
          }}
        />
        <RevealControl
          beat={beat}
          elapsedSec={elapsedSec}
          interactionRevealed={interactionRevealed}
          onReveal={revealNtpU}
        />
        <Caption beat={beat} elapsedSec={elapsedSec} selected={selectedConstellation} />
        <FinaleChrome beat={beat} elapsedSec={elapsedSec} onReplay={replay} />
        <TeachingAnimationTransport
          currentTimeSec={currentEffectiveCourseTime}
          durationSec={GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onStepBackward={handleStepBackward}
          onStepForward={handleStepForward}
          onSpeedChange={handleSpeedChange}
          stepSeconds={5}
        />
        <span className="global-constellation-accessible-status" role="status" aria-live="polite">
          第 {beat.order} 拍：{beat.eyebrow}；{GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC} 秒導演流程
        </span>
      </section>
    </main>
  );
}

export type { GlobalConstellationBeatId };
export { GLOBAL_CONSTELLATION_COLOURS, GLOBAL_CONSTELLATION_PLAYBACK_SPEEDS };
