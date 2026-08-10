import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import { useC120Locale } from './i18n';

export interface C120ResetDialogProps {
  readonly open: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/**
 * Resolves the next focusable control in a dialog, wrapping at either edge.
 * An index outside the dialog is treated as entry from the matching edge.
 */
export function getC120ResetDialogFocusIndex(
  currentIndex: number,
  focusableCount: number,
  shiftKey: boolean,
): number {
  if (focusableCount <= 0) return -1;
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= focusableCount) {
    return shiftKey ? focusableCount - 1 : 0;
  }
  const step = shiftKey ? -1 : 1;
  return (currentIndex + step + focusableCount) % focusableCount;
}

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true',
  );
}

export function C120ResetDialog({ open, onCancel, onConfirm }: C120ResetDialogProps) {
  const { locale, text } = useC120Locale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  const restorePreviouslyFocusedElement = () => {
    const previouslyFocused = previouslyFocusedRef.current;
    previouslyFocusedRef.current = null;
    if (previouslyFocused?.isConnected) previouslyFocused.focus();
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (!open) {
      const dialog = dialogRef.current;
      if (dialog?.open && typeof dialog.close === 'function') dialog.close();
      if (wasOpenRef.current) restorePreviouslyFocusedElement();
      wasOpenRef.current = false;
      return;
    }

    if (wasOpenRef.current) return;
    const activeElement = document.activeElement;
    previouslyFocusedRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    wasOpenRef.current = true;
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    cancelButtonRef.current?.focus();
  }, [open]);

  useEffect(() => () => {
    if (wasOpenRef.current) restorePreviouslyFocusedElement();
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (dialog === null) return;
    const focusableElements = getFocusableElements(dialog);
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    const nextIndex = getC120ResetDialogFocusIndex(currentIndex, focusableElements.length, event.shiftKey);
    if (nextIndex < 0) return;
    event.preventDefault();
    focusableElements[nextIndex]?.focus();
  };

  if (!open) return null;

  return (
    <div className="c120-dialog-backdrop">
      <dialog
        ref={dialogRef}
        className="c120-reset-dialog"
        lang={locale}
        role="dialog"
        aria-modal="true"
        aria-labelledby="c120-reset-title"
        aria-describedby="c120-reset-description"
        onKeyDown={handleKeyDown}
        onCancel={event => {
          event.preventDefault();
          onCancel();
        }}
        data-testid="c120-reset-dialog"
      >
        <h2 id="c120-reset-title">{text('要重設這台裝置上的 C-120 進度嗎？', 'Reset this local C-120 session?')}</h2>
        <p id="c120-reset-description">
          {text(
            '目前的作答與進度會清除，但已建立的存檔點仍會保留，而且重設後可立即按一次「復原重設」。',
            'This clears the current answers and progress. A saved checkpoint remains available, and one “Undo reset” action will be offered afterward.',
          )}
        </p>
        <div className="c120-button-row">
          <button ref={cancelButtonRef} type="button" onClick={onCancel}>{text('取消', 'Cancel')}</button>
          <button className="c120-danger" type="button" onClick={onConfirm}>{text('確認重設', 'Confirm reset')}</button>
        </div>
      </dialog>
    </div>
  );
}

export default C120ResetDialog;
