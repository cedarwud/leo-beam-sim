import { useEffect, useMemo, useRef, useState } from 'react';

import { C120EvidenceLedger } from './C120EvidenceLedger';
import { C120TrialLedger } from './C120TrialLedger';
import { C120ResetDialog } from './C120ResetDialog';
import { C120CourseScene } from './C120CourseScene';
import {
  C120_CLAIM_BOUNDARY,
  C120_SEGMENTS,
  C120ContractError,
  createValidatedC120Provider,
  type C120AuthoritativeReplay,
  type C120ConstructedResponseKey,
  type C120CourseDataProvider,
  type C120ReplayInput,
  type C120Scenario,
  type C120SegmentId,
} from './contract';
import { C120_FIXTURE_PROVIDER, C120_STUB_PROVIDER } from './fixtures';
import { loadC120BundledProvider } from './bundledProvider';
import { resolveC120Replay } from './replay';
import {
  firstAnswerDelta,
  validateC120InteractionState,
  validateC120InteractionTransition,
  validateC120SegmentEvidence,
  type C120InteractionState,
  type C120ValidationIssue,
} from './learningState';
import {
  createInitialC120Telemetry,
  incrementC120ActiveSecond,
  makeC120RecoveryBundle,
  recordC120FirstAnswers,
  recordC120InvalidAction,
  recordC120Scaffold,
  restoreC120RecoveryBundle,
  serializeC120RecoveryBundle,
  setC120ActiveTimingPaused,
  validateC120Telemetry,
  type C120LearnerTelemetry,
  type C120RecoveryBundle,
} from './recovery';
import {
  addC120ReplayRecord,
  completeC120Segment,
  createC120Session,
  getC120SessionStorageKey,
  makeC120WorkbookInput,
  resetC120Session,
  restoreC120Session,
  serializeC120Session,
  setC120CheckpointOrdinal,
  setC120ClinicState,
  setC120ConstructedResponse,
  setC120HintProvenance,
  setC120MissionContract,
  setC120TransferState,
  type C120Session,
} from './session';
import {
  C120SegmentPanels,
  createInitialC120InteractionState,
} from './C120SegmentPanels';
import { C120RouteErrorBoundary } from './C120RouteErrorBoundary';
import { initialC120WorkbookStatus } from './workbookStatus';
import {
  C120LanguageSwitch,
  C120LocaleProvider,
  useC120Locale,
} from './i18n';
import './C120CourseRoute.scss';

export interface C120CourseRouteProps {
  readonly provider?: C120CourseDataProvider;
}

interface SessionLoadResult {
  readonly session: C120Session;
  readonly notice: string;
  readonly recovered: boolean;
}

interface LearnerEnvelope {
  readonly schemaVersion: 'c120-learner-envelope-v2';
  readonly providerId: string;
  readonly scenarioId: string;
  readonly sourceMode: string;
  readonly activeSegment: C120SegmentId;
  readonly interaction: C120InteractionState;
  readonly telemetry: C120LearnerTelemetry;
}

interface LearnerLoadResult {
  readonly activeSegment: C120SegmentId;
  readonly interaction: C120InteractionState;
  readonly telemetry: C120LearnerTelemetry;
  readonly notice: string;
}

function browserRequestedProvider(): C120CourseDataProvider {
  if (typeof window === 'undefined') return C120_FIXTURE_PROVIDER;
  return new URLSearchParams(window.location.search).get('source') === 'fallback'
    ? C120_STUB_PROVIDER
    : C120_FIXTURE_PROVIDER;
}

function browserRequestedSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('source') === 'real-data' ? (params.get('snapshot') ?? '') : null;
}

function newSessionId(provider: C120CourseDataProvider): string {
  const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}`;
  return `c120-${provider.providerId}-${nonce}`;
}

function loadSession(provider: C120CourseDataProvider): SessionLoadResult {
  if (typeof window === 'undefined') {
    return {
      session: createC120Session(provider, { sessionId: newSessionId(provider) }),
      notice: 'Fresh in-memory session.',
      recovered: false,
    };
  }
  const key = getC120SessionStorageKey(provider);
  let serialized: string | null;
  try {
    serialized = window.localStorage.getItem(key);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'browser storage unavailable';
    return {
      session: createC120Session(provider, { sessionId: newSessionId(provider) }),
      notice: `Local storage unavailable; using a recoverable in-memory session: ${reason}`,
      recovered: false,
    };
  }
  if (serialized === null) {
    return {
      session: createC120Session(provider, { sessionId: newSessionId(provider) }),
      notice: 'Fresh local session.',
      recovered: false,
    };
  }
  try {
    return {
      session: restoreC120Session(serialized, provider),
      notice: 'Recovered strict provider-bound checkpoint.',
      recovered: true,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown recovery error';
    return {
      session: createC120Session(provider, { sessionId: newSessionId(provider) }),
      notice: `Stored session rejected fail closed: ${reason}`,
      recovered: false,
    };
  }
}

function learnerStorageKey(provider: C120CourseDataProvider): string {
  return `${getC120SessionStorageKey(provider)}:learner-v2`;
}

function checkpointStorageKey(provider: C120CourseDataProvider): string {
  return `${getC120SessionStorageKey(provider)}:checkpoint-v1`;
}

function firstOpenSegment(completed: readonly C120SegmentId[]): C120SegmentId {
  const next = C120_SEGMENTS.find(segment => !completed.includes(segment.id));
  return next?.id ?? 'transfer';
}

function isUnlockedSegment(segmentId: C120SegmentId, completed: readonly C120SegmentId[]): boolean {
  const firstIncompleteIndex = C120_SEGMENTS.findIndex(segment => !completed.includes(segment.id));
  const candidateIndex = C120_SEGMENTS.findIndex(segment => segment.id === segmentId);
  return completed.includes(segmentId) || firstIncompleteIndex === -1 || candidateIndex <= firstIncompleteIndex;
}

function hashSegment(completed: readonly C120SegmentId[]): C120SegmentId | null {
  if (typeof window === 'undefined') return null;
  const candidate = window.location.hash.replace(/^#/, '') as C120SegmentId;
  return C120_SEGMENTS.some(segment => segment.id === candidate) && isUnlockedSegment(candidate, completed)
    ? candidate
    : null;
}

function loadLearnerEnvelope(
  provider: C120CourseDataProvider,
  scenario: C120Scenario,
  completed: readonly C120SegmentId[],
): LearnerLoadResult {
  const fresh = createInitialC120InteractionState();
  const freshSegment = firstOpenSegment(completed);
  const fallback: LearnerLoadResult = {
    activeSegment: freshSegment,
    interaction: fresh,
    telemetry: createInitialC120Telemetry(),
    notice: 'Fresh learner evidence envelope.',
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(learnerStorageKey(provider));
    if (raw === null) return { ...fallback, activeSegment: hashSegment(completed) ?? freshSegment };
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('learner envelope must be an object');
    const expectedKeys = ['schemaVersion', 'providerId', 'scenarioId', 'sourceMode', 'activeSegment', 'interaction', 'telemetry'];
    if (JSON.stringify(Object.keys(parsed).sort()) !== JSON.stringify(expectedKeys.sort())) {
      throw new Error('learner envelope has unknown or missing fields');
    }
    const envelope = parsed as Partial<LearnerEnvelope>;
    const identity = scenario.manifest.scenario;
    if (
      envelope.schemaVersion !== 'c120-learner-envelope-v2'
      || envelope.providerId !== identity.providerId
      || envelope.scenarioId !== identity.scenarioId
      || envelope.sourceMode !== identity.sourceMode
      || envelope.interaction === undefined
      || envelope.telemetry === undefined
      || envelope.activeSegment === undefined
      || !C120_SEGMENTS.some(segment => segment.id === envelope.activeSegment)
    ) return { ...fallback, notice: 'Stored learner envelope rejected fail closed; starting fresh.' };
    const restoredSegment = isUnlockedSegment(envelope.activeSegment, completed) ? envelope.activeSegment : freshSegment;
    return {
      activeSegment: hashSegment(completed) ?? restoredSegment,
      interaction: validateC120InteractionState(envelope.interaction),
      telemetry: validateC120Telemetry(envelope.telemetry),
      notice: 'Recovered strict learner choices, active segment, and telemetry.',
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'invalid learner envelope';
    return { ...fallback, notice: `Stored learner envelope rejected fail closed: ${reason}` };
  }
}

function restoreLastReplay(session: C120Session, scenario: C120Scenario): C120AuthoritativeReplay | null {
  const record = session.replayRecords[session.replayRecords.length - 1];
  if (record === undefined) return null;
  try {
    return resolveC120Replay(scenario, record.input);
  } catch {
    return null;
  }
}

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function trajectoryTruthLabel(
  scenario: C120Scenario,
  text: (zhHant: string, en: string) => string,
): string {
  if (scenario.manifest.scenario.providerKind === 'canonical-adapter') {
    return scenario.manifest.scenario.fixtureVersion.startsWith('c120-materialized-canonical-adapter-v2-')
      ? text('SGP4 模型產生的軌跡。課程能量仍為模擬資料。', 'SGP4 model-derived trajectory. Course energy remains simulated data.')
      : text('SGP4 模型產生 TLE 位置錨點。重播軌跡為模擬資料。', 'SGP4 model-derived TLE anchor. Replay trajectory is simulated data.');
  }
  return text('模擬教學軌跡', 'SIMULATED FIXTURE TRAJECTORY');
}

const C120_SEGMENT_LABELS: Readonly<Record<C120SegmentId, readonly [string, string]>> = {
  'claim-detective': ['先問：這個比較站得住腳嗎？', 'Start here: does this comparison hold up?'],
  'tle-anchor': ['從資料走到服務窗口', 'From source data to the service window'],
  'lab-a': ['實驗 A：同一工作，節奏不同', 'Lab A: same job, different pace'],
  'lab-b': ['實驗 B：何時切換比較穩？', 'Lab B: when is a switch stable?'],
  recovery: ['停下來，也能接著做', 'Pause and pick up again'],
  'lab-c': ['實驗 C：在期限內安排傳送', 'Lab C: schedule sends within the deadline'],
  clinic: ['證據診間：只用當下看得到的資料', 'Evidence clinic: use only what was visible then'],
  transfer: ['把方法帶到另一個問題', 'Carry the method to another problem'],
};

function C120CourseExperience({ provider }: C120CourseRouteProps) {
  const { locale, text, formatNumber } = useC120Locale();
  const selectedProvider = useMemo(() => provider ?? browserRequestedProvider(), [provider]);
  const validatedProvider = useMemo(() => createValidatedC120Provider(selectedProvider), [selectedProvider]);
  const scenario = useMemo(() => validatedProvider.getScenario(), [validatedProvider]);
  const loaded = useMemo(() => loadSession(validatedProvider), [validatedProvider]);
  const learnerLoaded = useMemo(
    () => loadLearnerEnvelope(validatedProvider, scenario, loaded.session.completedSegments),
    [loaded.session.completedSegments, scenario, validatedProvider],
  );
  const rejectedStoredProgress = /rejected/i.test(`${loaded.notice} ${learnerLoaded.notice}`);
  const [session, setSession] = useState<C120Session>(loaded.session);
  const [interaction, setInteraction] = useState<C120InteractionState>(learnerLoaded.interaction);
  const [telemetry, setTelemetry] = useState<C120LearnerTelemetry>(learnerLoaded.telemetry);
  const [activeSegment, setActiveSegment] = useState<C120SegmentId>(learnerLoaded.activeSegment);
  const [activeReplay, setActiveReplay] = useState<C120AuthoritativeReplay | null>(() => restoreLastReplay(loaded.session, scenario));
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [notice, setNotice] = useState(() => rejectedStoredProgress
    ? text('舊進度與目前課程資料不相符，因此已安全開啟新的進度。', 'Stored progress did not match the current course data, so a fresh session was opened safely.')
    : loaded.recovered
      ? text('已從這台裝置恢復上次進度。', 'Your previous progress was restored on this device.')
      : text('進度會自動保存在這台裝置。', 'Progress saves automatically on this device.'));
  const [exportPreview, setExportPreview] = useState(() => text(
    `尚未匯出學習單。已完成 ${loaded.session.completedSegments.length}/8 段`,
    initialC120WorkbookStatus({
      recovered: loaded.recovered,
      status: loaded.session.status,
      completedSegmentCount: loaded.session.completedSegments.length,
    }),
  ));
  const [completionIssue, setCompletionIssue] = useState<C120ValidationIssue | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<C120RecoveryBundle | null>(null);
  const [checkpointAvailable, setCheckpointAvailable] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem(checkpointStorageKey(validatedProvider)) !== null; } catch { return false; }
  });
  const [checkpointSnapshot, setCheckpointSnapshot] = useState<C120RecoveryBundle | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const previousActiveSegmentRef = useRef<C120SegmentId>(activeSegment);
  const previousLocaleRef = useRef(locale);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(getC120SessionStorageKey(validatedProvider), serializeC120Session(session, validatedProvider));
    } catch (error) {
      console.warn('C-120 session persistence unavailable', error);
      setNotice(text(
        '這台裝置目前無法自動保存進度。請先匯出學習單備份。',
        'Progress cannot be saved automatically on this device. Export the workbook as a backup.',
      ));
    }
  }, [session, text, validatedProvider]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const identity = scenario.manifest.scenario;
    const envelope: LearnerEnvelope = {
      schemaVersion: 'c120-learner-envelope-v2',
      providerId: identity.providerId,
      scenarioId: identity.scenarioId,
      sourceMode: identity.sourceMode,
      activeSegment,
      interaction,
      telemetry,
    };
    try {
      window.localStorage.setItem(learnerStorageKey(validatedProvider), JSON.stringify(envelope));
    } catch (error) {
      console.warn('C-120 learner evidence persistence unavailable', error);
      setNotice(text(
        '作答紀錄目前無法自動保存。請先匯出學習單備份。',
        'Answers cannot be saved automatically. Export the workbook as a backup.',
      ));
    }
  }, [activeSegment, interaction, scenario, telemetry, text, validatedProvider]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setTelemetry(current => incrementC120ActiveSecond(current, activeSegment));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSegment]);

  useEffect(() => {
    if (previousLocaleRef.current === locale) return;
    previousLocaleRef.current = locale;
    setNotice(text(
      '顯示語言已切換；作答與進度不變。',
      'Language changed; answers and progress are unchanged.',
    ));
    setExportPreview(text(
      `${session.status === 'COMPLETE' ? '完整' : '未完成'}學習單。${session.completedSegments.length}/8 段`,
      `${session.status} workbook. ${session.completedSegments.length}/8 segments.`,
    ));
    setRunError(null);
  // Locale is the intentional trigger. Session changes must not overwrite action feedback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${activeSegment}`);
    if (previousActiveSegmentRef.current === activeSegment) {
      return;
    }
    previousActiveSegmentRef.current = activeSegment;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('c120-segment-title')?.focus();
      document.querySelector<HTMLElement>(`[data-segment-id="${activeSegment}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSegment]);

  useEffect(() => {
    if (!playing || activeReplay === null) return;
    if (frameIndex >= activeReplay.frames.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setFrameIndex(index => index + 1), 850);
    return () => window.clearTimeout(timer);
  }, [activeReplay, frameIndex, playing]);

  const displayFrame = activeReplay?.frames[Math.min(frameIndex, activeReplay.frames.length - 1)] ?? scenario.tle.frame;
  const completedCount = session.completedSegments.length;
  const firstIncompleteIndex = C120_SEGMENTS.findIndex(segment => !session.completedSegments.includes(segment.id));

  const updateInteraction = (next: C120InteractionState) => {
    let checked: C120InteractionState;
    try {
      checked = validateC120InteractionTransition(interaction, next);
    } catch (error) {
      console.warn('C-120 interaction transition rejected', error);
      setTelemetry(current => recordC120InvalidAction(current, activeSegment, 'interaction-transition-rejected'));
      setNotice(text(
        '這個選擇不符合目前題目的條件，因此沒有套用。請回看本段的上一個選擇，再試一次。',
        'That choice does not fit the current task, so it was not applied. Review the previous choice in this segment and try again.',
      ));
      return;
    }
    setTelemetry(current => recordC120FirstAnswers(current, firstAnswerDelta(interaction, checked)));
    setInteraction(checked);
    setCompletionIssue(null);
    setSession(current => {
      let updated = current;
      const missionContractId = checked.missionContractId === '' ? null : checked.missionContractId;
      if (updated.missionContractId !== missionContractId) {
        updated = setC120MissionContract(updated, missionContractId, validatedProvider);
      }
      const domainId = checked.transferDomainId === '' ? null : checked.transferDomainId;
      const retrievalAnswerId = checked.retrievalAnswerId === '' ? null : checked.retrievalAnswerId;
      const transfer = {
        domainId,
        retrievalAnswerId,
        retrievalPowerEnergyId: checked.retrievalPowerEnergyId === '' ? null : checked.retrievalPowerEnergyId,
        retrievalDynamicPolicyId: checked.retrievalDynamicPolicyId === '' ? null : checked.retrievalDynamicPolicyId,
        retrievalPredictionSavingId: checked.retrievalPredictionSavingId === '' ? null : checked.retrievalPredictionSavingId,
        transferWhatIfId: checked.transferWhatIfId === '' ? null : checked.transferWhatIfId,
        powerTimePathwayId: checked.powerTimePathwayId === '' ? null : checked.powerTimePathwayId,
      };
      if (JSON.stringify(updated.transfer) !== JSON.stringify(transfer)) {
        updated = setC120TransferState(updated, transfer);
      }
      return updated;
    });
  };

  const updateResponse = (key: C120ConstructedResponseKey, value: string) => {
    setCompletionIssue(null);
    setSession(current => {
      const previous = current.constructedResponses[key] ?? '';
      if (previous.trim() === '' && value.trim() !== '') {
        setTelemetry(existing => recordC120FirstAnswers(existing, [[`response:${key}`, 'entered']]));
      }
      return setC120ConstructedResponse(current, key, value);
    });
  };

  const runInput = (input: C120ReplayInput) => {
    try {
      if (input.surface === 'lab-c' && !interaction.labCPredictionFrozen) {
        throw new C120ContractError('Lab C replay requires a frozen prediction');
      }
      if (input.surface === 'lab-c' && input.revisionOrdinal === 0 && input.withheldEvent !== 'none'
        && !interaction.labCBaselineSeen) {
        throw new C120ContractError('Lab C first schedule requires the post-freeze baseline replay');
      }
      const replay = resolveC120Replay(scenario, input);
      setSession(current => {
        let updated = addC120ReplayRecord(current, validatedProvider, replay);
        if (input.surface === 'clinic') {
          const featureIds = scenario.clinic.featureCards
            .filter(card => interaction.clinicAvailability[card.id] === 'available')
            .map(card => card.id);
          updated = setC120ClinicState(updated, {
            actionId: input.actionId,
            featureSetId: input.featureSetId,
            selectedFeatureIds: featureIds,
            replayInputId: replay.replayInputId,
          }, validatedProvider);
        }
        return updated;
      });
      setActiveReplay(replay);
      setFrameIndex(0);
      setPlaying(true);
      setRunError(null);
      setCompletionIssue(null);
      setNotice(text(
        '結果已更新。你剛才的選擇已完成重播。',
        'Result updated. Your decision has finished replaying.',
      ));
    } catch {
      const reason = input.surface === 'lab-c'
        ? text(
          '這組六時槽安排不在目前課程案例中。請載入課程提供的復原安排，或改選另一個可用組合。',
          'This six-slot schedule is not part of the current course scenario. Load the course recovery schedule or choose another available combination.',
        )
        : text(
          '目前課程案例沒有這個選擇的結果。請檢查已凍結的選擇，再試一次。',
          'The current course scenario has no result for this choice. Check the frozen choice and try again.',
        );
      setRunError(reason);
      setPlaying(false);
      setTelemetry(current => recordC120InvalidAction(current, activeSegment, `${input.surface}:replay-rejected`));
      if (input.surface === 'lab-c') {
        setSession(current => setC120HintProvenance(current, [
          ...new Set([...current.hintProvenance, 'lab-c:documented-recovery-preset-offered']),
        ]));
      }
    }
  };

  const focusValidationIssue = (issue: C120ValidationIssue) => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      const container = document.getElementById(issue.fieldId);
      const target = container?.matches('button, input, select, textarea')
        ? container
        : container?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]');
      (target as HTMLElement | null)?.focus();
    });
  };

  const completeSegment = (segmentId: C120SegmentId) => {
    const issue = validateC120SegmentEvidence({
      segment: segmentId,
      state: interaction,
      scenario,
      responses: session.constructedResponses,
      activeReplay,
      replayRecords: session.replayRecords,
      checkpointOrdinal: session.checkpointOrdinal,
    });
    if (issue !== null) {
      setCompletionIssue(issue);
      setTelemetry(current => recordC120InvalidAction(current, segmentId, issue.code));
      setNotice(text(
        '還差一個步驟。焦點已移到需要補完的位置。',
        'One item is still missing. Focus moved to the place that needs attention.',
      ));
      focusValidationIssue(issue);
      return;
    }
    setCompletionIssue(null);
    setSession(current => completeC120Segment(current, segmentId));
    const index = C120_SEGMENTS.findIndex(segment => segment.id === segmentId);
    const next = C120_SEGMENTS[index + 1];
    if (next !== undefined) setActiveSegment(next.id);
    setNotice(text(
      '這一段完成了，答案與結果都已保存。',
      'This segment is complete. Your answer and result are saved.',
    ));
  };

  const bundleFor = (
    sessionValue: C120Session,
    interactionValue: C120InteractionState,
    telemetryValue: C120LearnerTelemetry,
    segmentValue: C120SegmentId,
  ) => {
    const workbook = validatedProvider.buildWorkbook(makeC120WorkbookInput(sessionValue, validatedProvider));
    return makeC120RecoveryBundle(
      validatedProvider,
      workbook,
      sessionValue,
      interactionValue,
      telemetryValue,
      segmentValue,
    );
  };

  const applyRecoveryBundle = (bundle: C120RecoveryBundle, message: string) => {
    setSession(bundle.session);
    setInteraction(bundle.interaction);
    setTelemetry(bundle.telemetry);
    setActiveSegment(bundle.activeSegment);
    setActiveReplay(restoreLastReplay(bundle.session, scenario));
    setFrameIndex(0);
    setPlaying(false);
    setRunError(null);
    setCompletionIssue(null);
    setResetDialogOpen(false);
    setExportPreview(text(
      `${bundle.workbook.status === 'COMPLETE' ? '完整' : '未完成'}學習單。${bundle.workbook.completedSegments.length}/8 段，已重新開啟。`,
      `${bundle.workbook.status} workbook. ${bundle.workbook.completedSegments.length}/8 segments. Reopened with the matching course data.`,
    ));
    setNotice(message);
  };

  const checkpoint = () => {
    try {
      const updated = setC120CheckpointOrdinal(session, session.checkpointOrdinal + 1);
      const bundle = bundleFor(updated, interaction, telemetry, activeSegment);
      setSession(updated);
      setCheckpointSnapshot(bundle);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(checkpointStorageKey(validatedProvider), serializeC120RecoveryBundle(bundle));
      }
      setCheckpointAvailable(true);
      setNotice(text(
        '已建立可復原的課堂存檔點。',
        'A restorable classroom checkpoint was saved.',
      ));
    } catch (error) {
      console.warn('C-120 checkpoint save failed', error);
      setNotice(text(
        '存檔點無法保存。目前進度仍在畫面中，請匯出學習單備份。',
        'The checkpoint could not be saved. Your current progress is still on screen. Export a workbook backup.',
      ));
    }
  };

  const restoreCheckpoint = () => {
    try {
      let bundle = checkpointSnapshot;
      if (bundle === null && typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(checkpointStorageKey(validatedProvider));
        if (raw !== null) bundle = restoreC120RecoveryBundle(raw, validatedProvider);
      }
      if (bundle === null) throw new Error('no checkpoint exists for this provider and scenario');
      applyRecoveryBundle(bundle, text(
        '先前的課堂存檔點已恢復。',
        'The previous classroom checkpoint is restored.',
      ));
    } catch (error) {
      console.warn('C-120 checkpoint restore rejected', error);
      setNotice(text(
        '這個存檔點與目前課程資料不相符，因此沒有開啟。',
        'That checkpoint does not match the current course data, so it was not opened.',
      ));
    }
  };

  const confirmReset = () => {
    try {
      setUndoSnapshot(bundleFor(session, interaction, telemetry, activeSegment));
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(getC120SessionStorageKey(validatedProvider));
        window.localStorage.removeItem(learnerStorageKey(validatedProvider));
      }
    } catch {
      setUndoSnapshot(null);
    }
    const fresh = resetC120Session(validatedProvider, { sessionId: newSessionId(validatedProvider) });
    setSession(fresh);
    setInteraction(createInitialC120InteractionState());
    setTelemetry(createInitialC120Telemetry());
    setActiveSegment('claim-detective');
    setActiveReplay(null);
    setFrameIndex(0);
    setPlaying(false);
    setRunError(null);
    setCompletionIssue(null);
    setResetDialogOpen(false);
    setExportPreview(text('尚未匯出學習單。', 'No workbook has been exported yet.'));
    setNotice(text(
      '本機進度已重設。需要時可按「復原重設」或恢復存檔點。課程資料本身沒有被修改。',
      'Local progress was reset. Use “Undo reset” or restore a checkpoint if needed. Course data was not changed.',
    ));
  };

  const undoReset = () => {
    if (undoSnapshot === null) return;
    applyRecoveryBundle(undoSnapshot, text(
      '已復原重設前的進度。',
      'Progress from before the reset was restored.',
    ));
    setUndoSnapshot(null);
  };

  const useFallback = () => {
    if (typeof window === 'undefined') return;
    window.location.assign('/course/c120?source=fallback');
  };

  const exportWorkbook = () => {
    try {
      const updatedTelemetry = { ...telemetry, exportCount: telemetry.exportCount + 1 };
      const bundle = bundleFor(session, interaction, updatedTelemetry, activeSegment);
      const { workbook } = bundle;
      const serialized = serializeC120RecoveryBundle(bundle);
      if (typeof window !== 'undefined') {
        const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = safeFilename(`c120-reopenable-${workbook.status.toLowerCase()}-${workbook.sessionId}.json`);
        link.click();
        URL.revokeObjectURL(url);
      }
      setTelemetry(updatedTelemetry);
      setExportPreview(text(
        `${workbook.status === 'COMPLETE' ? '完整' : '未完成'}學習單。${workbook.completedSegments.length}/8 段，${workbook.constructedResponseCount}/8 份短答，${workbook.replayRecords.length} 次結果重播。`,
        `${workbook.status} workbook. ${workbook.completedSegments.length}/8 segments, ${workbook.constructedResponseCount}/8 responses, ${workbook.replayRecords.length} authoritative replay records.`,
      ));
      setNotice(text(
        '學習單已匯出。這份檔案可以在同一套課程資料中重新開啟。',
        'Workbook exported. It can be reopened with the same course data.',
      ));
    } catch (error) {
      console.warn('C-120 workbook export failed', error);
      setNotice(text(
        '學習單無法匯出，進度仍保留在畫面中。',
        'The workbook could not be exported; your progress remains on screen.',
      ));
    }
  };

  const importWorkbook = async (file: File) => {
    try {
      const bundle = restoreC120RecoveryBundle(await file.text(), validatedProvider);
      applyRecoveryBundle(bundle, text(
        `已從 ${file.name} 重新開啟${bundle.workbook.status === 'COMPLETE' ? '完整' : '未完成'}學習單。`,
        `${bundle.workbook.status} workbook reopened from ${file.name}.`,
      ));
    } catch (error) {
      setTelemetry(current => recordC120InvalidAction(current, activeSegment, 'workbook-import-rejected'));
      console.warn('C-120 workbook import rejected', error);
      setNotice(text(
        '這份學習單不屬於目前課程資料，因此沒有開啟。',
        'This workbook does not belong to the current course data, so it was not opened.',
      ));
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const recordScaffold = (eventId: string) => {
    setTelemetry(current => recordC120Scaffold(current, eventId));
    setSession(current => setC120HintProvenance(current, [...new Set([...current.hintProvenance, eventId])]));
  };

  const recordInstructorRescue = () => {
    setTelemetry(current => ({ ...current, instructorRescueCount: current.instructorRescueCount + 1 }));
    setNotice(text('教師協助已記錄，不會改寫你的答案。', 'Instructor assistance was recorded without changing your answers.'));
  };

  const selectSegment = (segment: C120SegmentId, index: number) => {
    const unlocked = session.completedSegments.includes(segment) || firstIncompleteIndex === -1 || index <= firstIncompleteIndex;
    if (!unlocked) return;
    setActiveSegment(segment);
    setRunError(null);
    setCompletionIssue(null);
  };

  const progressPercent = Math.round((completedCount / C120_SEGMENTS.length) * 100);
  const dataSourceExplanation = scenario.manifest.scenario.providerKind === 'canonical-adapter'
    ? text(
      '位置資料使用課前固定的公開 TLE 與 SGP4 模型。服務、通訊與能量欄位來自可重播的課程資料，單位與來源會在各段標示。',
      'Position data uses a pre-class pinned public TLE and SGP4 model. Service, communication, and energy fields come from replayable course data, with units and provenance shown in each segment.',
    )
    : text(
      '本課程使用固定情境與可重播資料，讓相同選擇得到可重現的結果。每個數值保留單位，來源會在相應段落標示。',
      'This course uses a fixed scenario and replayable data, so the same choice has a reproducible consequence. Each value keeps its unit, and its provenance is shown in the relevant segment.',
    );

  return (
    <main
      className="c120-route"
      lang={locale}
      data-testid="c120-course-route"
      data-provider-kind={validatedProvider.kind}
      data-provider-id={validatedProvider.providerId}
      data-source-mode={scenario.manifest.scenario.sourceMode}
      data-scenario-id={scenario.manifest.scenario.scenarioId}
      aria-labelledby="c120-title"
    >
      <a className="c120-skip-link" href="#c120-learning-workbench">
        {text('直接前往目前的學習任務', 'Skip to the current learning task')}
      </a>

      <header className="c120-header c120-header--classroom">
        <div className="c120-header__main">
          <p className="c120-kicker">C-120 · LEO / NTPU</p>
          <h1 id="c120-title">{text('能源決策：選擇、預測、重播', 'Energy decisions: choose, predict, replay')}</h1>
          <p className="c120-lede">
            {text(
              '從固定情境開始，先說出你的預測，再看服務、功率與累積能量怎麼一起變化。',
              'Start with a fixed scenario. Make a prediction, then watch service, power, and accumulated energy change together.',
            )}
          </p>
        </div>
        <div className="c120-header__tools">
          <C120LanguageSwitch />
          <p className="c120-header__progress">
            <strong>{text(`已完成 ${completedCount}/8 段`, `${completedCount}/8 segments complete`)}</strong>
            <span>{progressPercent}%</span>
          </p>
          <progress value={completedCount} max={C120_SEGMENTS.length} aria-label={text('課程完成進度', 'Course completion progress')}>
            {progressPercent}%
          </progress>
        </div>
      </header>

      <section className="c120-data-notice" aria-labelledby="c120-data-notice-title">
        <div aria-hidden="true">i</div>
        <div>
          <h2 id="c120-data-notice-title">{text('先看這次課程使用的資料範圍', 'Start with the course data scope')}</h2>
          <p className="c120-claim-bar" data-testid="c120-claim-boundary">{C120_CLAIM_BOUNDARY}</p>
          <details className="c120-data-explanation">
            <summary>{text('這些資料怎麼組成？', 'How is this course data assembled?')}</summary>
            <p>{dataSourceExplanation}</p>
          </details>
        </div>
      </section>

      <div className="c120-secondary-tools">
      <details className="c120-course-map">
        <summary>{text('查看或回到其他課程段落', 'View or return to another course segment')}</summary>
        <nav className="c120-segment-nav" aria-label={text('120 分鐘課程段落', '120-minute course segments')}>
          {C120_SEGMENTS.map((segment, index) => {
            const complete = session.completedSegments.includes(segment.id);
            const unlocked = complete || firstIncompleteIndex === -1 || index <= firstIncompleteIndex;
            return (
              <button
                key={segment.id}
                type="button"
                disabled={!unlocked}
                aria-current={activeSegment === segment.id ? 'step' : undefined}
                data-complete={complete}
                data-segment-id={segment.id}
                onClick={() => selectSegment(segment.id, index)}
              >
                <span aria-hidden="true">{complete ? '✓' : index + 1}</span>
                <span><strong>{text(...C120_SEGMENT_LABELS[segment.id])}</strong><small>{segment.clock}</small></span>
                <small>{complete ? text('已完成', 'Complete') : unlocked ? text('可操作', 'Available') : text('尚未開放', 'Locked')}</small>
              </button>
            );
          })}
        </nav>
      </details>
      <details className="c120-teacher-tools">
        <summary>{text('存檔、學習單與教師工具', 'Saving, workbook, and instructor tools')}</summary>
        <div className="c120-status-row" aria-label={text('課程存檔與匯出狀態', 'Session and export status')}>
          <p>
            <strong>{text(`存檔點 #${session.checkpointOrdinal}`, `Checkpoint #${session.checkpointOrdinal}`)}</strong>
            {' / '}{text('主動操作計時', 'Active-work timer')} {telemetry.activeTimingPaused ? text('已暫停', 'paused') : text('進行中', 'running')}
          </p>
          <div className="c120-status-actions">
            <button type="button" aria-pressed={telemetry.activeTimingPaused} onClick={() => {
              setTelemetry(current => setC120ActiveTimingPaused(current, !current.activeTimingPaused));
              setNotice(telemetry.activeTimingPaused
                ? text('主動操作計時已繼續。', 'Active-work timing resumed.')
                : text('主動操作計時已暫停；教師講解與等待時間不會計入。', 'Active-work timing paused; instructor talk and waiting are excluded.'));
            }}>
              {telemetry.activeTimingPaused ? text('繼續操作計時', 'Resume active-work timer') : text('暫停操作計時', 'Pause active-work timer')}
            </button>
            <button type="button" onClick={checkpoint}>{text('建立存檔點', 'Save checkpoint')}</button>
            <button type="button" disabled={!checkpointAvailable} onClick={restoreCheckpoint}>{text('恢復存檔點', 'Restore checkpoint')}</button>
            {undoSnapshot && <button type="button" onClick={undoReset}>{text('復原重設', 'Undo reset')}</button>}
            <button type="button" data-testid="c120-export" onClick={exportWorkbook}>{text('匯出可重開的學習單', 'Export reopenable workbook')}</button>
            <button type="button" onClick={() => importInputRef.current?.click()}>{text('匯入並重新開啟學習單', 'Import and reopen workbook')}</button>
            <input ref={importInputRef} hidden type="file" name="c120-workbook-import" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) void importWorkbook(file); }}/>
          </div>
          <p className="c120-export-preview" data-testid="c120-export-status"><strong>{text('學習單', 'Workbook')}</strong> / {exportPreview}</p>
          <details className="c120-technical-details">
            <summary>{text('課程資料識別（需要時再查看）', 'Course data identity (open when needed)')}</summary>
            <dl className="c120-identity-lock">
              <div><dt>{text('案例', 'Scenario')}</dt><dd>{scenario.manifest.scenario.scenarioId}</dd></div>
              <div><dt>{text('資料提供者', 'Provider')}</dt><dd>{validatedProvider.kind} / {validatedProvider.providerId}</dd></div>
              <div><dt>{text('資料模式', 'Source')}</dt><dd>{scenario.manifest.scenario.sourceMode}</dd></div>
              <div><dt>{text('合約版本', 'Contract')}</dt><dd>{scenario.manifest.contractVersion}</dd></div>
            </dl>
          </details>
        </div>
      </details>
      </div>

      <p className="c120-save-notice" aria-live="polite" role="status">{notice}</p>

      <div className="c120-course-layout">
        <C120SegmentPanels
          activeSegment={activeSegment}
          scenario={scenario}
          state={interaction}
          responses={session.constructedResponses}
          activeReplay={activeReplay}
          runError={runError}
          completedSegments={session.completedSegments}
          checkpointOrdinal={session.checkpointOrdinal}
          completionIssue={completionIssue}
          onState={updateInteraction}
          onResponse={updateResponse}
          onRunInput={runInput}
          onComplete={completeSegment}
          onCheckpoint={checkpoint}
          onReset={() => setResetDialogOpen(true)}
          onUseFallback={useFallback}
          onScaffold={recordScaffold}
          onRecordInstructorRescue={recordInstructorRescue}
        />

        <aside className="c120-visual-column" aria-label={text('選擇結果的視覺重播', 'Visual replay of the decision result')}>
          <div className="c120-replay-heading">
            <p className="c120-eyebrow">{text('結果畫面', 'Result view')}</p>
            <h2>{text('看看剛才的選擇造成什麼變化', 'See what changed after your decision')}</h2>
            <p>{text('畫面只負責顯示；所有數值都來自同一份課程重播資料。', 'The scene only displays results; every value comes from the same course replay data.')}</p>
          </div>
          <C120CourseScene frame={displayFrame} trajectoryTruthLabel={trajectoryTruthLabel(scenario, text)}/>
          <section className="c120-timeline" aria-label={text('結果重播控制', 'Replay timeline controls')}>
            <div className="c120-timeline__meta">
              <span>{activeReplay === null ? text('尚未執行結果重播', 'No decision replay yet') : text('結果重播', 'Decision replay')}</span>
              <span>{text('畫面', 'frame')} {formatNumber(frameIndex + 1)} / {formatNumber(activeReplay?.frames.length ?? 1)}</span>
            </div>
            <div className="c120-timeline__controls">
              <button type="button" disabled={activeReplay === null} onClick={() => {
                if (playing) {
                  setPlaying(false);
                } else {
                  if (activeReplay && frameIndex >= activeReplay.frames.length - 1) setFrameIndex(0);
                  setPlaying(true);
                }
              }}>{playing ? text('暫停重播', 'Pause replay') : text('播放結果', 'Play result')}</button>
              <input
                aria-label={text('選擇重播畫面', 'Select replay frame')}
                type="range"
                min={0}
                max={Math.max(0, (activeReplay?.frames.length ?? 1) - 1)}
                value={frameIndex}
                onChange={event => { setPlaying(false); setFrameIndex(Number(event.target.value)); }}
              />
              <button type="button" aria-label={text('上一個重播畫面', 'Previous replay frame')} disabled={activeReplay === null || frameIndex === 0} onClick={() => { setPlaying(false); setFrameIndex(index => Math.max(0, index - 1)); }}>←</button>
              <button type="button" disabled={activeReplay === null || frameIndex >= (activeReplay?.frames.length ?? 1) - 1} onClick={() => { setPlaying(false); setFrameIndex(index => Math.min((activeReplay?.frames.length ?? 1) - 1, index + 1)); }}>{text('下一個畫面', 'Next frame')} →</button>
            </div>
          </section>
          <p className="c120-visually-hidden" role="status" aria-live="polite" aria-atomic="true">
            {activeReplay !== null && !playing
              ? text(
                `結果停在第 ${frameIndex + 1} 格；服務${displayFrame.evidence.servicePass ? '達標' : '未達標'}。`,
                `Result paused at frame ${frameIndex + 1}; service ${displayFrame.evidence.servicePass ? 'passes' : 'fails'}.`,
              )
              : ''}
          </p>
          <details className="c120-replay-details">
            <summary>{text('查看數值證據與技術紀錄', 'View numerical evidence and technical records')}</summary>
            <C120EvidenceLedger replay={activeReplay} currentFrameIndex={frameIndex} onFrameSelect={index => { setPlaying(false); setFrameIndex(index); }} ledgerDefaultOpen={false}/>
            <C120TrialLedger records={session.replayRecords}/>
          </details>
        </aside>
      </div>

      <C120ResetDialog open={resetDialogOpen} onCancel={() => setResetDialogOpen(false)} onConfirm={confirmReset}/>

      <footer className="c120-footer">
        <span>{text('120 分鐘。最多 8 份短答，可保存並重新開啟。', '120 minutes. Up to 8 short responses. Save and reopen.')}</span>
        <span>{C120_CLAIM_BOUNDARY}</span>
      </footer>
    </main>
  );
}

function C120BundledCourseExperience({ snapshotId }: { readonly snapshotId: string }) {
  const { locale, text } = useC120Locale();
  const [provider, setProvider] = useState<C120CourseDataProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setProvider(null);
    setError(null);
    void loadC120BundledProvider(snapshotId).then(
      loaded => { if (current) setProvider(loaded); },
      reason => { if (current) setError(reason instanceof Error ? reason.message : String(reason)); },
    );
    return () => { current = false; };
  }, [snapshotId]);
  if (provider !== null) return <C120CourseExperience provider={provider}/>;
  return (
    <main className="c120-route c120-bundle-status" lang={locale} aria-busy={error === null}>
      <p className="c120-claim-bar">{C120_CLAIM_BOUNDARY}</p>
      <C120LanguageSwitch />
      <p className="c120-kicker">{text('明確選用。課前固定版本的公開資料', 'EXPLICIT OPT-IN. PINNED PUBLIC-SOURCE SNAPSHOT')}</p>
      <h1>{error === null ? text('正在確認課前資料…', 'Verifying the pre-class bundle…') : text('指定的資料包未通過檢查', 'Requested data bundle rejected')}</h1>
      {error === null
        ? <p role="status" aria-live="polite">{text('正在確認資料清單、TLE 內容與課程案例是否完全相符；確認完成前不會偷偷改用模擬案例。', 'Checking the manifest, exact TLE bytes, and course identity. The simulated fixture will not be selected silently.')}</p>
        : <><p role="alert">{text('為避免把不同案例混在一起，這份資料沒有載入。你可以明確回到一致的模擬教學案例。', 'To avoid mixing scenarios, this bundle was not loaded. You can explicitly return to the coherent simulated teaching fixture.')}</p><details><summary>{text('教師診斷資訊', 'Instructor diagnostic')}</summary><p>{error}</p></details><p><a href="/course/c120">{text('使用一致的模擬教學案例', 'Use the coherent simulated teaching fixture')}</a></p></>}
      <p className="c120-claim-bar">{C120_CLAIM_BOUNDARY}</p>
    </main>
  );
}

export function C120CourseRoute(props: C120CourseRouteProps) {
  const requestedSnapshot = props.provider === undefined ? browserRequestedSnapshot() : null;
  return (
    <C120LocaleProvider>
      <C120RouteErrorBoundary>
        {requestedSnapshot === null
          ? <C120CourseExperience {...props}/>
          : <C120BundledCourseExperience snapshotId={requestedSnapshot}/>}
      </C120RouteErrorBoundary>
    </C120LocaleProvider>
  );
}

export default C120CourseRoute;
