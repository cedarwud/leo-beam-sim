import type { CSSProperties } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';

export const panelStyle: CSSProperties = {
  // Fill the (left-rail) container instead of forcing a fixed 520px — otherwise the
  // SINR-formula panel overflows the rail and gets clipped. The rail width is the
  // governing dimension now (main.scss --leo-left-drawer-width).
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  maxHeight: 'calc(100vh - 88px)',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  background: UI_TOKENS.color.surface.tuningPanel,
  backdropFilter: 'blur(12px)',
  border: `1px solid ${UI_TOKENS.color.border.tuningPanel}`,
  borderRadius: UI_TOKENS.radius.panel,
  boxShadow: UI_TOKENS.shadow.tuningPanel,
  padding: 20,
  color: UI_TOKENS.color.text.panel,
  fontSize: UI_TOKENS.type.size.body,
  boxSizing: 'border-box',
  display: 'grid',
  gap: 16,
};
export const collapsedPanelStyle: CSSProperties = {
  ...panelStyle,
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'center',
  gap: 0,
  overflow: 'hidden',
  overflowY: 'hidden',
  padding: 0,
};

export const drawerContentStyle: CSSProperties = {
  display: 'grid',
  gap: 0,
  minWidth: 0,
  width: '100%',
};

export const dividerStyle: CSSProperties = {
  height: 1,
  background: UI_TOKENS.color.border.subtle,
};

export const controlStackStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
};

export const pagePanelStyle: CSSProperties = {
  display: 'grid',
  gap: 15,
};

export const symbolStyle: CSSProperties = {
  fontFamily: UI_TOKENS.type.family.math,
  fontSize: UI_TOKENS.type.size.readout,
  fontWeight: UI_TOKENS.type.weight.strong,
  color: UI_TOKENS.color.text.symbol,
  lineHeight: 1,
};

export const formulaTextStyle: CSSProperties = {
  fontFamily: UI_TOKENS.type.family.math,
  fontSize: UI_TOKENS.type.size.formula,
  color: UI_TOKENS.color.text.math,
  lineHeight: 1.35,
};

export const compactDetailsStyle: CSSProperties = {
  color: UI_TOKENS.color.text.muted,
  fontSize: UI_TOKENS.type.size.body,
  lineHeight: 1.5,
};

export const compactSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  color: UI_TOKENS.color.text.secondary,
  fontWeight: UI_TOKENS.type.weight.strong,
};

export const explanatoryTextStyle: CSSProperties = {
  color: UI_TOKENS.color.text.secondary,
  fontSize: UI_TOKENS.type.size.body,
  lineHeight: 1.48,
};

export const srOnlyStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};
