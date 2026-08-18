import type {
  VisualLabExperience,
  VisualLabLocale,
  VisualLabTheme,
} from './visualLabPresentationContract';

/**
 * One copy shape for every supported locale.  Consumers select a registry once
 * at the shell seam; they should not scatter locale conditionals through route
 * markup.  The registry intentionally contains labels and short explanations,
 * not evidence, numbers, or formatting decisions.
 */
export interface VisualLabCopyRegistry {
  readonly shell: {
    readonly eyebrow: string;
    readonly title: string;
    readonly subtitle: string;
    readonly currentData: string;
  };
  readonly source: {
    readonly section: string;
    readonly constellation: string;
    readonly selectedTime: string;
    readonly archive: string;
    readonly propagation: string;
    readonly apply: string;
    readonly applying: string;
    readonly pending: string;
    readonly accepted: string;
    readonly sourceUnavailable: string;
  };
  readonly sceneScale: {
    readonly section: string;
    readonly global: string;
    readonly globalDescription: string;
    readonly ntpu: string;
    readonly ntpuDescription: string;
    readonly service: string;
    readonly serviceDescription: string;
  };
  readonly moduleLabels: {
    readonly scene: string;
    readonly handover: string;
    readonly sinr: string;
    readonly power: string;
    readonly throughput: string;
    readonly energyEfficiency: string;
  };
  readonly resultGroups: {
    readonly serving: string;
    readonly candidate: string;
    readonly context: string;
    readonly handover: string;
    readonly linkQuality: string;
    readonly power: string;
    readonly throughput: string;
    readonly energyEfficiency: string;
  };
  readonly timelineTransport: {
    readonly section: string;
    readonly play: string;
    readonly pause: string;
    readonly next: string;
    readonly previous: string;
    readonly restart: string;
    readonly currentTime: string;
    readonly progress: string;
    readonly locked: string;
  };
  readonly storyControls: {
    readonly section: string;
    readonly interHandover: string;
    readonly intraHandover: string;
    readonly inspect: string;
    readonly inspectScene: string;
    readonly inspectHandover: string;
    readonly inspectSinr: string;
    readonly inspectPower: string;
    readonly inspectThroughput: string;
    readonly inspectEnergyEfficiency: string;
    readonly forkToExplore: string;
    readonly noStory: string;
  };
  readonly figureCapture: {
    readonly section: string;
    readonly capture: string;
    readonly captureReady: string;
    readonly captureProfile: string;
    readonly lockedPresentation: string;
    readonly evidenceIdentity: string;
    readonly publicationView: string;
  };
  readonly unavailable: {
    readonly generic: string;
    readonly noAcceptedRun: string;
    readonly noCanonicalHandover: string;
    readonly noCanonicalBeamTrace: string;
    readonly candidateUnavailable: string;
    readonly waitingForSource: string;
  };
  readonly error: {
    readonly section: string;
    readonly sourceLoad: string;
    readonly frameBuild: string;
    readonly invalidSelection: string;
    readonly retry: string;
    readonly keepPrevious: string;
  };
}

const ZH_HANT_COPY: VisualLabCopyRegistry = {
  shell: {
    eyebrow: '多波束低軌衛星 · 節能視覺化',
    title: '多波束低軌衛星節能實驗室',
    subtitle: '從全球軌道拉近到 NTPU，逐步加入換手、鏈路與能源分析。',
    currentData: '目前資料',
  },
  source: {
    section: '衛星軌道資料',
    constellation: '衛星星系',
    selectedTime: '選定時間',
    archive: 'TLE 封存資料',
    propagation: '軌道計算',
    apply: '套用設定',
    applying: '正在建立場景',
    pending: '正在準備軌道與鏈路資料',
    accepted: '資料已就緒',
    sourceUnavailable: '所選軌道資料不可用',
  },
  sceneScale: {
    section: '場景尺度',
    global: '全球軌道',
    globalDescription: '觀察 Starlink 與 OneWeb 的衛星分布和真實軌道。',
    ntpu: 'NTPU 區域',
    ntpuDescription: '聚焦觀測點上空的通過軌跡與可見衛星。',
    service: 'NTPU 多波束',
    serviceDescription: '觀察服務鏈路、候選鏈路、波束與 UE 的關係。',
  },
  moduleLabels: {
    scene: '場景與軌道資料',
    handover: '換手判定',
    sinr: '鏈路品質',
    power: '系統功率',
    throughput: '傳輸速率',
    energyEfficiency: '能源效率',
  },
  resultGroups: {
    serving: '服務鏈路',
    candidate: '候選鏈路',
    context: '背景衛星',
    handover: '換手結果',
    linkQuality: '鏈路品質結果',
    power: '功率結果',
    throughput: '傳輸速率結果',
    energyEfficiency: '能源效率結果',
  },
  timelineTransport: {
    section: '時間軸控制',
    play: '播放',
    pause: '暫停',
    next: '下一段',
    previous: '上一段',
    restart: '重新開始',
    currentTime: '目前時間',
    progress: '計算進度',
    locked: '尚未完成計算，時間軸暫時鎖定',
  },
  storyControls: {
    section: '故事控制',
    interHandover: '跨衛星換手',
    intraHandover: '同衛星波束切換',
    inspect: '查看',
    inspectScene: '查看場景',
    inspectHandover: '查看換手',
    inspectSinr: '查看 SINR',
    inspectPower: '查看功率',
    inspectThroughput: '查看傳輸速率',
    inspectEnergyEfficiency: '查看能源效率',
    forkToExplore: '轉入自由探索',
    noStory: '目前沒有可播放的來源故事',
  },
  figureCapture: {
    section: '論文圖與擷取',
    capture: '擷取畫面',
    captureReady: '畫面已鎖定，可供擷取',
    captureProfile: '圖表設定檔',
    lockedPresentation: '已鎖定呈現設定',
    evidenceIdentity: '證據識別',
    publicationView: '出版用暖白視圖',
  },
  unavailable: {
    generic: '目前資料不可用',
    noAcceptedRun: '尚未完成真實 TLE / SGP4 運算。',
    noCanonicalHandover: '目前資料沒有跨衛星換手紀錄。',
    noCanonicalBeamTrace: '目前資料沒有同衛星波束識別紀錄。',
    candidateUnavailable: '目前時刻沒有可用的候選鏈路。',
    waitingForSource: '等待來源資料完成。',
  },
  error: {
    section: '資料錯誤',
    sourceLoad: '無法載入所選軌道資料。',
    frameBuild: '無法建立這個時刻的計算畫面。',
    invalidSelection: '選定的星系或時間無效。',
    retry: '重新嘗試',
    keepPrevious: '繼續顯示上一筆結果',
  },
};

const EN_COPY: VisualLabCopyRegistry = {
  shell: {
    eyebrow: 'Multi-beam LEO · energy visualization',
    title: 'Multi-Beam LEO Energy Visual Lab',
    subtitle: 'Move from global orbits to NTPU, then reveal handover, link, and energy relationships.',
    currentData: 'Current data',
  },
  source: {
    section: 'Satellite orbit data',
    constellation: 'Constellation',
    selectedTime: 'Selected time',
    archive: 'Archived TLE data',
    propagation: 'Orbit propagation',
    apply: 'Apply settings',
    applying: 'Building scene',
    pending: 'Preparing orbit and link data',
    accepted: 'Data ready',
    sourceUnavailable: 'Selected orbit data is unavailable',
  },
  sceneScale: {
    section: 'Scene scale',
    global: 'Global orbits',
    globalDescription: 'Compare the satellite distribution and real trajectories of Starlink and OneWeb.',
    ntpu: 'NTPU region',
    ntpuDescription: 'Focus on passes and visible satellites above the observation site.',
    service: 'NTPU multi-beam',
    serviceDescription: 'Follow serving links, candidate links, beams, and UEs together.',
  },
  moduleLabels: {
    scene: 'Scene and orbit data',
    handover: 'Handover decision',
    sinr: 'Link quality',
    power: 'System power',
    throughput: 'Throughput',
    energyEfficiency: 'Energy efficiency',
  },
  resultGroups: {
    serving: 'Serving link',
    candidate: 'Candidate link',
    context: 'Context satellites',
    handover: 'Handover result',
    linkQuality: 'Link-quality results',
    power: 'Power results',
    throughput: 'Throughput results',
    energyEfficiency: 'Energy-efficiency results',
  },
  timelineTransport: {
    section: 'Timeline controls',
    play: 'Play',
    pause: 'Pause',
    next: 'Next segment',
    previous: 'Previous segment',
    restart: 'Restart',
    currentTime: 'Current time',
    progress: 'Computation progress',
    locked: 'The timeline stays locked until computation is complete',
  },
  storyControls: {
    section: 'Story controls',
    interHandover: 'Inter-satellite handover',
    intraHandover: 'Intra-satellite beam switch',
    inspect: 'Inspect',
    inspectScene: 'Inspect scene',
    inspectHandover: 'Inspect handover',
    inspectSinr: 'Inspect SINR',
    inspectPower: 'Inspect power',
    inspectThroughput: 'Inspect throughput',
    inspectEnergyEfficiency: 'Inspect energy efficiency',
    forkToExplore: 'Fork to free exploration',
    noStory: 'No source-backed story is available',
  },
  figureCapture: {
    section: 'Paper figure and capture',
    capture: 'Capture frame',
    captureReady: 'Frame locked and ready to capture',
    captureProfile: 'Figure profile',
    lockedPresentation: 'Locked presentation settings',
    evidenceIdentity: 'Evidence identity',
    publicationView: 'Warm-white publication view',
  },
  unavailable: {
    generic: 'Data is currently unavailable',
    noAcceptedRun: 'The real TLE / SGP4 run is not complete yet.',
    noCanonicalHandover: 'The current data has no inter-satellite handover record.',
    noCanonicalBeamTrace: 'The current data has no same-satellite beam-identity record.',
    candidateUnavailable: 'No candidate link is available at this instant.',
    waitingForSource: 'Waiting for source data to finish.',
  },
  error: {
    section: 'Data error',
    sourceLoad: 'The selected orbit data could not be loaded.',
    frameBuild: 'The calculation frame could not be built for this instant.',
    invalidSelection: 'The selected constellation or time is invalid.',
    retry: 'Retry',
    keepPrevious: 'Keep the previous result visible',
  },
};

export const VISUAL_LAB_COPY: Readonly<Record<VisualLabLocale, VisualLabCopyRegistry>> = Object.freeze({
  'zh-Hant': ZH_HANT_COPY,
  en: EN_COPY,
});

export function visualLabCopy(locale: VisualLabLocale): VisualLabCopyRegistry {
  return VISUAL_LAB_COPY[locale];
}

/**
 * A copy lookup that keeps experience selection separate from localization.
 * Experience is intentionally accepted here only for future copy extensions;
 * it never changes evidence identity or theme tokens.
 */
export function visualLabExperienceCopy(
  locale: VisualLabLocale,
  _experience: VisualLabExperience,
): VisualLabCopyRegistry {
  return visualLabCopy(locale);
}
