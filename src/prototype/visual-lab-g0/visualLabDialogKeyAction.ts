export interface VisualLabDialogKeyActionInput {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly activeIndex: number;
  readonly focusableCount: number;
}

export type VisualLabDialogKeyAction =
  | { readonly type: 'close' }
  | { readonly type: 'focus'; readonly index: number }
  | null;

/** Resolve dialog keyboard policy without reading the DOM or owning lifecycle. */
export function resolveVisualLabDialogKeyAction(
  input: VisualLabDialogKeyActionInput,
): VisualLabDialogKeyAction {
  if (input.key === 'Escape') return { type: 'close' };
  if (input.key !== 'Tab' || input.focusableCount <= 0) return null;
  if (input.shiftKey && input.activeIndex === 0) {
    return { type: 'focus', index: input.focusableCount - 1 };
  }
  if (!input.shiftKey && input.activeIndex === input.focusableCount - 1) {
    return { type: 'focus', index: 0 };
  }
  return null;
}
