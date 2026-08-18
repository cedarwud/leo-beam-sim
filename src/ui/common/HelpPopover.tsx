// Generic "?" help popover, shared by the left SINR parameter panel and the
// right KPI/InfoPanel. Replaces the old always-on paragraph of explanatory
// text under each control: the label now gets a small "?" button, and the
// definition/formula/"what happens if you tune this" copy only shows up
// when a student actually asks for it.
//
// Contract: shared/CONTRACT.md §3 (owner: agent-B). Do not add new npm
// dependencies here — positioning is a hand-rolled viewport clamp, not
// floating-ui.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type JSX,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../../i18n';
import { UI_TOKENS } from '../../constants/uiTokens';
import {
  closeHelpPopover,
  getActiveHelpId,
  openHelpPopover,
  subscribeHelpPopover,
} from './helpPopoverStore';
import { renderFormulaText } from './formulaText';

export interface HelpPopoverProps {
  /** Stable id. Becomes data-testid="help-popover-trigger-<helpId>" / "help-popover-panel-<helpId>". */
  readonly helpId: string;
  /** i18n key for the title. If titleText is also given, titleText wins. */
  readonly titleKey?: string;
  readonly titleText?: string;
  /** i18n key for the "what is this" body. If bodyText is also given, bodyText wins. */
  readonly bodyKey?: string;
  readonly bodyText?: string;
  /** "what happens if you tune this", optional. */
  readonly effectKey?: string;
  readonly effectText?: string;
  /** Optional formula block, rendered above the body. */
  readonly formula?: ReactNode;
  /** Optional meta line(s): units, range, SIMULATED TEACHING tag, etc. */
  readonly meta?: ReactNode;
  /** Popover direction. Default 'left' (opens toward the panel's inside, away from the sidebar edge). */
  readonly placement?: 'left' | 'right' | 'bottom';
}

const PANEL_MAX_WIDTH = 320;
const PANEL_ESTIMATED_HEIGHT = 180;
const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 8;
const TRIGGER_HIT_SIZE = 44;
const TRIGGER_DOT_SIZE = 18;
const POPOVER_Z_INDEX = 1000;

interface AnchoredRect {
  readonly top: number;
  readonly left: number;
}

/** Prefer the resolved translation; fall back to a bilingual literal if `t()` had nothing better than the raw key. */
function withFallback(resolved: string, key: string, isEnglish: boolean, zh: string, en: string): string {
  if (resolved !== key) return resolved;
  return isEnglish ? en : zh;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * The outermost sidebar (`<aside>`) the trigger lives in, if any.
 *
 * Anchoring to the TRIGGER puts the panel inside the rail, where it covers the
 * very controls it is describing. Anchoring to the rail's outer edge puts it in
 * the centre scene instead, so the control and its explanation are readable at
 * the same time (owner call 2026-08-06: 懸浮視窗不要在側邊欄裡面，要在側邊欄的右邊).
 *
 * Outermost, not nearest: the tuning panel is itself an `<aside>` nested inside
 * the shell rail, so `closest('aside')` would still land inside the rail.
 */
function resolveOuterSidebarRect(trigger: Element | null): DOMRect | null {
  let outer: Element | null = null;
  for (let node = trigger?.parentElement ?? null; node !== null; node = node.parentElement) {
    if (node.tagName === 'ASIDE') outer = node;
  }
  return outer?.getBoundingClientRect() ?? null;
}

function computeAnchoredRect(
  trigger: DOMRect,
  panelWidth: number,
  panelHeight: number,
  placement: 'left' | 'right' | 'bottom',
  sidebar: DOMRect | null,
): AnchoredRect {
  let top: number;
  let left: number;

  if (placement === 'bottom') {
    top = trigger.bottom + ANCHOR_GAP;
    left = trigger.left;
  } else if (placement === 'right') {
    // Right-hand rail: escape outward, i.e. to the LEFT of the rail.
    top = trigger.top;
    left = sidebar === null
      ? trigger.right + ANCHOR_GAP
      : sidebar.left - panelWidth - ANCHOR_GAP;
  } else {
    // Left-hand rail: escape outward, i.e. to the RIGHT of the rail.
    top = trigger.top;
    left = sidebar === null
      ? trigger.left - panelWidth - ANCHOR_GAP
      : sidebar.right + ANCHOR_GAP;
  }

  const maxLeft = Math.max(window.innerWidth - panelWidth - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
  const maxTop = Math.max(window.innerHeight - panelHeight - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
  return {
    top: clamp(top, VIEWPORT_MARGIN, maxTop),
    left: clamp(left, VIEWPORT_MARGIN, maxLeft),
  };
}

export function HelpPopover(props: HelpPopoverProps): JSX.Element {
  const {
    helpId,
    titleKey,
    titleText,
    bodyKey,
    bodyText,
    effectKey,
    effectText,
    formula,
    meta,
    placement = 'left',
  } = props;

  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';

  const activeHelpId = useSyncExternalStore(subscribeHelpPopover, getActiveHelpId, getActiveHelpId);
  const open = activeHelpId === helpId;

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);
  const [focused, setFocused] = useState(false);
  const [rect, setRect] = useState<AnchoredRect | null>(null);

  const title = titleText ?? (titleKey ? t(titleKey) : t('common.help'));
  const body = bodyText ?? (bodyKey ? t(bodyKey) : undefined);
  const effect = effectText ?? (effectKey ? t(effectKey) : undefined);

  // The catalog is `Record<string, string>`, so copy that wants a subscript can
  // only spell it `P_RF` / `G^T`. Typeset those here — one hook covers every "?"
  // in the app (left SINR/EE/policy rails and the right InfoPanel) without any
  // call site having to change. `formula` and `meta` are already ReactNode: the
  // caller hands us real JSX there, so they are passed through untouched.
  // `title` keeps its raw string form for aria-label / role=dialog naming.
  const titleNode = renderFormulaText(title);
  const bodyNode = renderFormulaText(body);
  const effectNode = renderFormulaText(effect);
  const effectHeading = withFallback(t('common.helpEffectLabel'), 'common.helpEffectLabel', isEnglish,
    '調整後會怎樣', 'What changes if you adjust this');
  const closeLabel = withFallback(t('common.close'), 'common.close', isEnglish, '關閉', 'Close');

  const close = useCallback(() => {
    closeHelpPopover(helpId);
  }, [helpId]);

  const toggle = useCallback(() => {
    if (activeHelpId === helpId) {
      closeHelpPopover(helpId);
    } else {
      openHelpPopover(helpId);
    }
  }, [activeHelpId, helpId]);

  // Position the panel relative to the trigger. Recomputed on open, and kept
  // in sync while open in case the layout shifts under it (resize / scroll of
  // an ancestor panel). Uses position:fixed viewport coordinates + a simple
  // clamp so the popover cannot be cut off by a sidebar's overflow, without
  // needing a positioning library.
  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return undefined;
    }

    const recompute = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const triggerBox = trigger.getBoundingClientRect();
      const panelWidth = panelRef.current?.offsetWidth ?? PANEL_MAX_WIDTH;
      const panelHeight = panelRef.current?.offsetHeight ?? PANEL_ESTIMATED_HEIGHT;
      // Re-read every recompute: the rail collapses/expands and the layout
      // reflows, so a cached rect would strand the popover mid-scene.
      const sidebarBox = resolveOuterSidebarRect(trigger);
      setRect(computeAnchoredRect(triggerBox, panelWidth, panelHeight, placement, sidebarBox));
    };

    recompute();
    // Second pass once the panel itself has rendered, so clamping uses the
    // real measured box instead of the PANEL_MAX_WIDTH/HEIGHT guess.
    const raf = window.requestAnimationFrame(recompute);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open, placement]);

  // Esc closes; click/tap outside the panel and trigger closes.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close();
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onPointerDown, true);
    };
  }, [open, close]);

  // Focus restore: when this instance transitions open -> closed (Esc,
  // outside click, close button, or another popover stealing "active"),
  // send keyboard focus back to the trigger so it's never left stranded.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  const panelNode: ReactNode = open && rect
    ? createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={title}
          data-testid={`help-popover-panel-${helpId}`}
          style={panelStyle(rect)}
        >
          <div style={titleStyle}>{titleNode}</div>
          {formula ? <div style={formulaStyle}>{formula}</div> : null}
          {body ? <div style={bodyStyle}>{bodyNode}</div> : null}
          {effect ? (
            <div style={effectBlockStyle}>
              <div style={effectLabelStyle}>{effectHeading}</div>
              <div style={bodyStyle}>{effectNode}</div>
            </div>
          ) : null}
          {meta ? <div style={metaStyle}>{meta}</div> : null}
          <button type="button" onClick={close} style={closeButtonStyle}>
            {closeLabel}
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={title}
        data-testid={`help-popover-trigger-${helpId}`}
        onClick={toggle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={triggerButtonStyle}
      >
        <span aria-hidden="true" style={triggerDotStyle(focused || open)}>?</span>
      </button>
      {panelNode}
    </>
  );
}

// --- styles -----------------------------------------------------------

const triggerButtonStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: TRIGGER_HIT_SIZE,
  height: TRIGGER_HIT_SIZE,
  padding: 0,
  margin: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  flexShrink: 0,
  WebkitTapHighlightColor: 'transparent',
};

function triggerDotStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: TRIGGER_DOT_SIZE,
    height: TRIGGER_DOT_SIZE,
    borderRadius: UI_TOKENS.radius.pill,
    background: active ? 'rgba(118, 234, 215, 0.22)' : UI_TOKENS.color.surface.cardSubtle,
    border: `1px solid ${active ? UI_TOKENS.color.border.focus : UI_TOKENS.color.semantic.tuning}`,
    boxShadow: active ? `0 0 0 3px ${UI_TOKENS.color.border.focusShadow}` : 'none',
    color: UI_TOKENS.color.semantic.tuning,
    fontSize: 12,
    fontWeight: UI_TOKENS.type.weight.strong,
    lineHeight: 1,
    pointerEvents: 'none',
    transition: 'box-shadow 120ms ease, background 120ms ease',
  };
}

function panelStyle(rect: AnchoredRect): CSSProperties {
  return {
    position: 'fixed',
    top: rect.top,
    left: rect.left,
    zIndex: POPOVER_Z_INDEX,
    width: 'max-content',
    maxWidth: PANEL_MAX_WIDTH,
    minWidth: 220,
    background: UI_TOKENS.color.surface.panel,
    border: `1px solid ${UI_TOKENS.color.border.panel}`,
    borderRadius: UI_TOKENS.radius.panel,
    boxShadow: UI_TOKENS.shadow.panel,
    padding: UI_TOKENS.space.panel,
    display: 'flex',
    flexDirection: 'column',
    gap: UI_TOKENS.space.md,
    color: UI_TOKENS.color.text.secondary,
  };
}

const titleStyle: CSSProperties = {
  fontSize: UI_TOKENS.type.size.subheading,
  fontWeight: UI_TOKENS.type.weight.strong,
  color: UI_TOKENS.color.semantic.tuning,
  lineHeight: 1.35,
};

const formulaStyle: CSSProperties = {
  fontFamily: UI_TOKENS.type.family.math,
  fontSize: UI_TOKENS.type.size.caption,
  color: UI_TOKENS.color.text.math,
  background: UI_TOKENS.color.surface.cardFaint,
  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
  borderRadius: UI_TOKENS.radius.md,
  padding: `${UI_TOKENS.space.sm}px ${UI_TOKENS.space.lg}px`,
};

const bodyStyle: CSSProperties = {
  fontSize: UI_TOKENS.type.size.caption,
  lineHeight: 1.6,
  color: UI_TOKENS.color.text.secondary,
};

const effectBlockStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  paddingTop: UI_TOKENS.space.sm,
  borderTop: `1px solid ${UI_TOKENS.color.border.subtle}`,
};

const effectLabelStyle: CSSProperties = {
  fontSize: UI_TOKENS.type.size.tiny,
  fontWeight: UI_TOKENS.type.weight.strong,
  color: UI_TOKENS.color.text.muted,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const metaStyle: CSSProperties = {
  fontSize: UI_TOKENS.type.size.tiny,
  lineHeight: 1.5,
  color: UI_TOKENS.color.text.faint,
};

const closeButtonStyle: CSSProperties = {
  alignSelf: 'flex-end',
  marginTop: UI_TOKENS.space.xs,
  padding: `${UI_TOKENS.space.xs}px ${UI_TOKENS.space.lg}px`,
  fontSize: UI_TOKENS.type.size.tiny,
  color: UI_TOKENS.color.text.primary,
  background: UI_TOKENS.color.surface.cardSubtle,
  border: `1px solid ${UI_TOKENS.color.border.soft}`,
  borderRadius: UI_TOKENS.radius.md,
  cursor: 'pointer',
};
