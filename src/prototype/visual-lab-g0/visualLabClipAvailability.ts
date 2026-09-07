import type {
  VisualLabClipAvailability,
  VisualLabClipId,
} from '../../visualLab/clipReplay/types';
import type { VisualLabLocale } from './presentation/visualLabPresentationContract';

export interface VisualLabClipAvailabilityInput {
  readonly locale: VisualLabLocale;
  readonly sourceLabel: string;
  readonly causalReplayAvailable: boolean;
  readonly acceptedRunReady: boolean;
  readonly hasSnapshot: boolean;
  readonly phaseReady: boolean;
  readonly interHandover: {
    readonly status: 'available' | 'unavailable';
    readonly selectedStoryId: string | null;
  };
  readonly intraHandover: {
    readonly status: 'available' | 'unavailable';
  };
}

function waitingReason(locale: VisualLabLocale, completeScene: boolean): string {
  if (!completeScene) return locale === 'zh-Hant' ? '等待完整場景建立。' : 'Waiting for the complete scene.';
  return locale === 'zh-Hant' ? '等待完整 A/B 場景建立。' : 'Waiting for the complete A/B scene.';
}

/** Project story/controller availability into the clip shelf's four entries. */
export function deriveVisualLabClipAvailability({
  locale,
  sourceLabel,
  causalReplayAvailable,
  acceptedRunReady,
  hasSnapshot,
  phaseReady,
  interHandover,
  intraHandover,
}: VisualLabClipAvailabilityInput): Partial<Record<VisualLabClipId, VisualLabClipAvailability>> {
  const completeScene = phaseReady && acceptedRunReady && hasSnapshot;
  const availability = {
    'inter-handover': {
      status: interHandover.status === 'available'
        ? causalReplayAvailable ? 'available' : 'pending'
        : 'unavailable',
      reason: interHandover.status === 'available'
        ? causalReplayAvailable ? null : waitingReason(locale, false)
        : locale === 'zh-Hant'
          ? '目前資料沒有完整的跨衛星換手三錨點。'
          : 'The current source has no complete three-anchor inter-satellite handover.',
      runtimeId: interHandover.selectedStoryId,
      sourceLabel,
    },
    'intra-beam-handover': {
      status: intraHandover.status === 'available'
        ? causalReplayAvailable ? 'available' : 'pending'
        : completeScene ? 'preparing' : 'unavailable',
      reason: intraHandover.status === 'available'
        ? causalReplayAvailable ? null : waitingReason(locale, false)
        : completeScene
          ? locale === 'zh-Hant'
            ? '播放時會先用同一筆 archived-TLE 真實資料建立 beam-hopping 三錨點，核對後才開始回放。'
            : 'Playback first builds and checks a beam-hopping three-anchor trace from the same archived-TLE run.'
          : locale === 'zh-Hant'
            ? '目前資料尚未完成，無法準備同衛星換束軌跡。'
            : 'The current source is not complete enough to prepare a same-satellite beam-switch trace.',
      runtimeId: 'intra-handover',
      sourceLabel,
    },
    'link-gain-ab': {
      status: causalReplayAvailable ? 'available' : 'pending',
      reason: causalReplayAvailable ? null : waitingReason(locale, false),
      runtimeId: 'beamwidth',
      sourceLabel,
    },
    'power-cap-ab': {
      status: causalReplayAvailable ? 'available' : 'pending',
      reason: causalReplayAvailable ? null : waitingReason(locale, false),
      runtimeId: 'power-cap',
      sourceLabel,
    },
  } satisfies Partial<Record<VisualLabClipId, VisualLabClipAvailability>>;
  return Object.freeze(availability);
}
