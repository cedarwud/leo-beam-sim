import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { symbolStyle } from './styles';

export function MathSymbol({
  children,
  size = 24,
  color = UI_TOKENS.color.text.symbol,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
}) {
  return <span style={{ ...symbolStyle, fontSize: size, color }}>{children}</span>;
}
