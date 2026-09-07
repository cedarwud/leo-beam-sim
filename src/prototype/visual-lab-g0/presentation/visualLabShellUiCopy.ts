import type {
  VisualLabLocale,
  VisualLabTheme,
} from './visualLabPresentationContract';

export interface VisualLabShellUiCopy {
  readonly sourceAria: string;
  readonly fieldAria: string;
  readonly modulesAria: string;
  readonly ntpuField: string;
  readonly globalField: string;
  readonly active: string;
  readonly added: string;
  readonly add: string;
  readonly unavailable: string;
  readonly building: string;
  readonly buildingHint: string;
  readonly centerAria: string;
  readonly showSceneLabels: string;
  readonly rebuilding: string;
  readonly replayLibrary: string;
  readonly closeReplay: string;
  readonly closeReplayLibrary: string;
  readonly intraHandover: string;
  readonly interHandover: string;
  readonly stopHandover: string;
  readonly downloadReplay: string;
  readonly recordingReplay: string;
  readonly replayDownloaded: string;
  readonly legendAria: string;
  readonly earthPrimary: string;
  readonly earthVisible: string;
  readonly earthContext: string;
  readonly skyServing: string;
  readonly skyCandidate: string;
  readonly skyContext: string;
  readonly serviceServing: string;
  readonly serviceCandidate: string;
  readonly serviceContext: string;
  readonly energy: string;
  readonly timelineBuilding: string;
  readonly timelineLocked: string;
  readonly calculationProgress: string;
  readonly resultBuilding: string;
  readonly resultLocked: string;
  readonly skipControls: string;
  readonly skipScene: string;
  readonly skipResults: string;
  readonly switchTheme: string;
}

const ZH_HANT_UI: Omit<VisualLabShellUiCopy, 'switchTheme'> = Object.freeze({
  sourceAria: '目前場景來源',
  fieldAria: '場域切換',
  modulesAria: '可逐步加入的分析模組',
  ntpuField: 'NTPU 場域',
  globalField: '全球軌道',
  active: '目前操作',
  added: '已加入',
  add: '加入',
  unavailable: '目前資料無法建立',
  building: '正在建立衛星軌道與鏈路結果',
  buildingHint: '完整計算完成後即可調整參數。',
  centerAria: '視覺化場景、故事與時間軸',
  showSceneLabels: '顯示標籤',
  rebuilding: '正在更新衛星軌道場景',
  replayLibrary: '情境回放',
  closeReplay: '結束回放',
  closeReplayLibrary: '關閉情境回放',
  intraHandover: '同衛星換手',
  interHandover: '跨衛星換手',
  stopHandover: '停止換手播放',
  downloadReplay: '下載回放',
  recordingReplay: '正在錄製回放…',
  replayDownloaded: '回放影片與來源資訊已下載。',
  legendAria: '場景圖例',
  earthPrimary: '服務、候選與軌跡',
  earthVisible: 'NTPU 可見衛星',
  earthContext: '同一 TLE 時刻的其他衛星',
  skyServing: '服務軌跡',
  skyCandidate: '候選軌跡',
  skyContext: '其他可見衛星',
  serviceServing: '服務衛星與波束',
  serviceCandidate: '候選衛星與波束',
  serviceContext: '其他衛星與干擾',
  energy: '能量流',
  timelineBuilding: '正在建立完整時間軸',
  timelineLocked: '計算完成前不開放尚未建立的時間點。',
  calculationProgress: '軌道與鏈路計算進度',
  resultBuilding: '正在建立計算結果',
  resultLocked: '目前還沒有可顯示的完整結果。',
  skipControls: '跳到參數控制',
  skipScene: '跳到視覺化場景',
  skipResults: '跳到計算結果',
});

const EN_UI: Omit<VisualLabShellUiCopy, 'switchTheme'> = Object.freeze({
  sourceAria: 'Current scene source',
  fieldAria: 'Field switch',
  modulesAria: 'Analysis modules that can be revealed progressively',
  ntpuField: 'NTPU field',
  globalField: 'Global orbit',
  active: 'Active',
  added: 'Shown',
  add: 'Add',
  unavailable: 'The selected data could not be built',
  building: 'Building orbit and link results',
  buildingHint: 'Controls become available when the complete calculation is ready.',
  centerAria: 'Visualization scene, story, and timeline',
  showSceneLabels: 'Show labels',
  rebuilding: 'Updating the satellite-orbit scene',
  replayLibrary: 'Scenario replay',
  closeReplay: 'End replay',
  closeReplayLibrary: 'Close scenario replay',
  intraHandover: 'Intra-satellite beam switch',
  interHandover: 'Inter-satellite handover',
  stopHandover: 'Stop handover playback',
  downloadReplay: 'Download replay',
  recordingReplay: 'Recording replay…',
  replayDownloaded: 'The replay video and provenance have been downloaded.',
  legendAria: 'Scene legend',
  earthPrimary: 'Serving, candidate, and trajectories',
  earthVisible: 'Satellites visible from NTPU',
  earthContext: 'Other satellites at the same TLE instant',
  skyServing: 'Serving pass',
  skyCandidate: 'Candidate pass',
  skyContext: 'Other visible satellites',
  serviceServing: 'Serving satellite and beams',
  serviceCandidate: 'Candidate satellite and beam',
  serviceContext: 'Other satellites and interference',
  energy: 'Energy flow',
  timelineBuilding: 'Building the complete timeline',
  timelineLocked: 'Times that have not been computed remain unavailable.',
  calculationProgress: 'Orbit and link computation progress',
  resultBuilding: 'Building computed results',
  resultLocked: 'No complete result is available yet.',
  skipControls: 'Skip to parameter controls',
  skipScene: 'Skip to visualization scene',
  skipResults: 'Skip to computed results',
});

/** Select stable shell labels without coupling localization to JSX. */
export function visualLabShellUiCopy(locale: VisualLabLocale, theme: VisualLabTheme): VisualLabShellUiCopy {
  const base = locale === 'zh-Hant' ? ZH_HANT_UI : EN_UI;
  return Object.freeze({
    ...base,
    switchTheme: theme === 'dark'
      ? (locale === 'zh-Hant' ? '切換至淺色主題' : 'Switch to light theme')
      : (locale === 'zh-Hant' ? '切換至深色主題' : 'Switch to dark theme'),
  });
}
