// Module-level "only one HelpPopover open at a time" registry.
//
// This is a plain module, not a React Context, so any HelpPopover instance
// can subscribe without a shared <Provider> ancestor. That matters here:
// the left SINR parameter panel and the right InfoPanel/KPI panel both
// render HelpPopover instances and have no common wrapper that would want
// to own "which popover is open" state — a Context would force one to be
// added just to carry this. A module singleton has no such requirement:
// import it, subscribe, done.
//
// Intended consumer is React's `useSyncExternalStore`: it re-renders a
// component whenever `notify()` fires, reading `getActiveHelpId()` as the
// snapshot. See HelpPopover.tsx for the subscribing side.

type Listener = () => void;

let activeHelpId: string | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** useSyncExternalStore subscribe function. */
export function subscribeHelpPopover(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** useSyncExternalStore snapshot function. */
export function getActiveHelpId(): string | null {
  return activeHelpId;
}

/**
 * Opens `helpId`. If a different popover was open, it is implicitly closed
 * (its own `open` derives from `getActiveHelpId() === helpId`, so it will
 * simply stop matching and unmount on the next render).
 */
export function openHelpPopover(helpId: string): void {
  if (activeHelpId === helpId) return;
  activeHelpId = helpId;
  notify();
}

/**
 * Closes the active popover. When `helpId` is given, this only takes effect
 * if that popover is the one currently active — so a stale close call (e.g.
 * a delayed Escape handler from a popover that already lost the "active"
 * race) can never clobber whatever popover the user opened next.
 */
export function closeHelpPopover(helpId?: string): void {
  if (activeHelpId === null) return;
  if (helpId !== undefined && activeHelpId !== helpId) return;
  activeHelpId = null;
  notify();
}

/** Test-only: resets module state between test cases. */
export function __resetHelpPopoverStoreForTests(): void {
  activeHelpId = null;
  listeners.clear();
}
