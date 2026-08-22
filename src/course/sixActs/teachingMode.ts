/**
 * Teaching mode — the classroom presentation of the homepage.
 *
 * The proposal's rule is that Act 4 does not rewrite the engineering dashboard;
 * it hides and scripts it. The consequence that actually needs code is state
 * isolation: a knob a lecturer turns in a classroom must never write into the
 * research workflow's persisted state.
 *
 * This module owns the mode itself, the URL flag, and the namespace rule. The
 * viewport layer reads it; nothing here renders.
 *
 * Note on the flag budget (`docs/frontend-change-contract.md` rule 5): this is a
 * route/session mode, not a render-plan flag or a scene lane. It adds no lane
 * and mounts no layer — the classroom surface is the same lane with panels
 * collapsed and the story director driving.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (M4).
 */

export type SixActsTeachingMode = 'engineering' | 'teaching';

/** `/?teaching=1`, the locator the operator kit already refers to. */
export const SIX_ACTS_TEACHING_URL_PARAM = 'teaching' as const;
/** The homepage preset that runs the handover teaching cinema. */
export const SIX_ACTS_PRESET_URL_PARAM = 'preset' as const;
export const SIX_ACTS_HANDOVER_PRESET = 'handover' as const;

export type SixActsTeachingPreset = 'none' | typeof SIX_ACTS_HANDOVER_PRESET;

/** Suffix appended to every persisted key while in teaching mode. */
export const SIX_ACTS_TEACHING_STORAGE_SUFFIX = '.teaching' as const;

export function readSixActsTeachingModeFromSearch(search: string): SixActsTeachingMode {
  const params = new URLSearchParams(search);
  const raw = params.get(SIX_ACTS_TEACHING_URL_PARAM);
  return raw === '1' || raw === 'true' ? 'teaching' : 'engineering';
}

export function readSixActsTeachingPresetFromSearch(search: string): SixActsTeachingPreset {
  const params = new URLSearchParams(search);
  return params.get(SIX_ACTS_PRESET_URL_PARAM) === SIX_ACTS_HANDOVER_PRESET
    ? SIX_ACTS_HANDOVER_PRESET
    : 'none';
}

/**
 * Returns the URL that expresses `mode`. Pure, so the caller decides whether to
 * push, replace, or merely display it.
 */
export function withSixActsTeachingMode(href: string, mode: SixActsTeachingMode): string {
  const url = new URL(href);
  if (mode === 'teaching') {
    url.searchParams.set(SIX_ACTS_TEACHING_URL_PARAM, '1');
  } else {
    url.searchParams.delete(SIX_ACTS_TEACHING_URL_PARAM);
    url.searchParams.delete(SIX_ACTS_PRESET_URL_PARAM);
  }
  return url.toString();
}

/**
 * Namespaces a persisted key for a mode.
 *
 * Engineering mode returns the key UNCHANGED. That is deliberate: the research
 * workflow's existing stored state stays exactly where it is, so introducing
 * teaching mode cannot lose anyone's setup. Teaching mode gets a suffix, which
 * cannot collide with an existing key because no existing key ends in it.
 */
export function sixActsScopedStorageKey(baseKey: string, mode: SixActsTeachingMode): string {
  if (baseKey.endsWith(SIX_ACTS_TEACHING_STORAGE_SUFFIX)) {
    throw new RangeError(`${baseKey} is already teaching-scoped; pass the engineering key`);
  }
  return mode === 'teaching' ? `${baseKey}${SIX_ACTS_TEACHING_STORAGE_SUFFIX}` : baseKey;
}

/** The slice of `Storage` this wrapper needs; injected so tests run headless. */
export interface SixActsKeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * A store that can only reach one mode's keys.
 *
 * Isolation is enforced here rather than at each call site: a lecturer's
 * hysteresis tweak physically cannot land in the engineering namespace, because
 * the scoped store never forms that key.
 */
export class SixActsScopedStore {
  readonly mode: SixActsTeachingMode;

  private readonly backing: SixActsKeyValueStore;

  constructor(backing: SixActsKeyValueStore, mode: SixActsTeachingMode) {
    this.backing = backing;
    this.mode = mode;
  }

  keyFor(baseKey: string): string {
    return sixActsScopedStorageKey(baseKey, this.mode);
  }

  read(baseKey: string): string | null {
    try {
      return this.backing.getItem(this.keyFor(baseKey));
    } catch {
      // Private-mode and blocked-storage browsers throw on access; a classroom
      // knob is not worth taking the page down for.
      return null;
    }
  }

  write(baseKey: string, value: string): void {
    try {
      this.backing.setItem(this.keyFor(baseKey), value);
    } catch {
      // Same: the in-memory session stays usable without persistence.
    }
  }

  clear(baseKey: string): void {
    try {
      this.backing.removeItem(this.keyFor(baseKey));
    } catch {
      // Same.
    }
  }
}

/**
 * Engineering surfaces the classroom collapses.
 *
 * Data rather than JSX conditionals so the list is reviewable in one place and
 * testable without mounting anything.
 */
export const SIX_ACTS_TEACHING_HIDDEN_SURFACES: readonly string[] = Object.freeze([
  'signal-tuning-tabs',
  'scene-topology-overrides',
  'scene-visual-scale-overrides',
  'modqn-replay-controls',
  'beam-hop-diagnostics',
]);

/**
 * Controls the classroom keeps, with the reason each one earns its place.
 *
 * Act 4's ping-pong experiment needs the policy knobs visible — the anti-ping-pong
 * guard is itself the teaching material, so hiding it would remove the lesson.
 */
export const SIX_ACTS_TEACHING_VISIBLE_CONTROLS: readonly {
  readonly id: string;
  readonly whyZhHant: string;
}[] = Object.freeze([
  Object.freeze({
    id: 'handover-offset-db',
    whyZhHant: 'Act 4 乒乓換手實驗的第一個旋鈕：將 offset 設為 0，以觀察無遲滯門檻時的行為。',
  }),
  Object.freeze({
    id: 'handover-ping-pong-guard',
    whyZhHant: '第二個旋鈕。防抖機制本身是教材的一部分，隱藏後將無法呈現該決策效果。',
  }),
  Object.freeze({
    id: 'timeline-transport',
    whyZhHant: '導演腳本會自動暫停；講師仍需保留時間軸回放與重述能力。',
  }),
]);

export function isSixActsTeachingSurfaceHidden(
  surfaceId: string,
  mode: SixActsTeachingMode,
): boolean {
  return mode === 'teaching' && SIX_ACTS_TEACHING_HIDDEN_SURFACES.includes(surfaceId);
}
