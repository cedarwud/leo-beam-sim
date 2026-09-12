import { useLocale } from '../../i18n';

export function StudentHandoverActivityLauncher({
  enabled,
  onStart,
}: {
  readonly enabled: boolean;
  readonly onStart: () => void;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === 'en';
  return (
    <button
      type="button"
      data-testid="student-guided-flow-launch"
      disabled={!enabled}
      onClick={onStart}
      title={isEnglish
        ? 'Open the bounded Intra handover student activity'
        : '開啟受限的 Intra 換手學生活動'}
      style={{
        flex: '0 0 auto', minHeight: 38, padding: '7px 11px', borderRadius: 8,
        border: '1px solid rgba(118,234,215,.7)',
        background: 'rgba(118,234,215,.12)', color: '#f1fbff',
        font: '600 14px/1.2 "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif',
        cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.45,
      }}
    >
      {isEnglish ? 'Student guided flow' : '學生引導活動'}
    </button>
  );
}


export function StudentHandoverModeBanner() {
  const { locale } = useLocale();
  const isEnglish = locale === 'en';
  return (
    <div
      data-testid="student-mode-banner"
      style={{
        flex: '0 0 auto', minHeight: 38, display: 'flex', alignItems: 'center',
        padding: '7px 11px', borderRadius: 8,
        border: '1px solid rgba(118,234,215,.7)',
        background: 'rgba(118,234,215,.12)', color: '#f1fbff',
        font: '700 14px/1.2 "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif',
      }}
    >
      {isEnglish ? 'R6 · Student guided flow' : 'R6 · 學生引導流程'}
    </div>
  );
}
