import { UI_TOKENS } from '../../constants/uiTokens';

export type StatusBadgeTone = 'serving' | 'candidate' | 'warning' | 'neutral';

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: string;
  tone?: StatusBadgeTone;
}) {
  const color = tone === 'serving'
    ? UI_TOKENS.color.semantic.serving.badge
    : tone === 'candidate'
      ? UI_TOKENS.color.semantic.candidate.badge
      : tone === 'warning'
        ? UI_TOKENS.color.semantic.warning.badge
        : UI_TOKENS.color.text.secondary;
  const border = tone === 'serving'
    ? UI_TOKENS.color.semantic.serving.badgeBorder
    : tone === 'candidate'
      ? UI_TOKENS.color.semantic.candidate.badgeBorder
      : tone === 'warning'
        ? UI_TOKENS.color.semantic.warning.badgeBorder
        : UI_TOKENS.color.border.soft;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 7px',
      borderRadius: UI_TOKENS.radius.pill,
      border: `1px solid ${border}`,
      color,
      background: tone === 'serving'
        ? 'rgba(250, 204, 21, 0.16)'
        : tone === 'candidate'
          ? 'rgba(56, 189, 248, 0.16)'
          : tone === 'warning'
            ? 'rgba(255, 125, 104, 0.14)'
            : UI_TOKENS.color.surface.card,
      fontSize: UI_TOKENS.type.size.tiny,
      fontWeight: UI_TOKENS.type.weight.heavy,
      lineHeight: 1.2,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}
