// Inline formula markup for help-popover copy.
//
// WHY THIS EXISTS
// ---------------
// The formulas a student actually *sees* on the panels are hand-written JSX
// (`<>P<sub>t</sub></>`), so they typeset correctly. The "?" popover body is
// different: it comes out of the i18n catalog (`src/i18n/strings.ts`), which is
// a `Record<string, string>` — plain strings, no markup. Copy authors already
// use Unicode where Unicode has a glyph (`σ²`, `N₀`, `log₂`, `·`, `÷`, `＝`),
// but Unicode only ships sub/superscripts for digits and a handful of letters.
// There is no `_RF`, `_tx`, `^R`, `_PA`, so those degrade to ASCII `_` and `^`
// in the popover while the on-panel formula next to them is properly typeset.
//
// This module closes that gap: a tiny, dependency-free `string -> tokens`
// scanner plus a React renderer that emits real `<sub>` / `<sup>`.
//
// It is deliberately NOT a math typesetter. The input is *inline prose* in
// Chinese or English with a few symbols embedded, not a formula block. A
// false positive here silently mangles a sentence, which is far worse than
// leaving one `_` un-prettified. Every rule below is biased toward "leave it
// alone unless it is unmistakably a script".
//
// SYNTAX
// ------
//   X_abc     -> X + <sub>abc</sub>       (bare run: ASCII letters/digits only)
//   X^abc     -> X + <sup>abc</sup>
//   X_{a,b}   -> X + <sub>a,b</sub>       (brace group: anything but braces)
//   X^{a,b}   -> X + <sup>a,b</sup>
//   X_a^b     -> X + <sub>a</sub> + <sup>b</sup>   (one of each, source order)
//
// THE TWO HARD CASES
// ------------------
// * `L_cl,NLoS` — a bare run stops at the comma, so this parses as
//   `L` + <sub>cl</sub> + literal ",NLoS". In running prose a comma is a
//   clause separator vastly more often than part of a subscript, and guessing
//   otherwise would eat the rest of a sentence. Authors who want the whole
//   thing subscripted write it explicitly: `L_{cl,NLoS}`.
//
// * `10^(P_tx/10)` — a parenthesised exponent is NOT raised; the `^(` is left
//   verbatim (the inner `P_tx` still becomes a subscript, because that part is
//   unambiguous). Raising it would need a second script level for `tx`, which
//   at the popover body size (16px) lands near 10px — unreadable on a dark
//   panel — and a long raised run cannot wrap, so it would overflow the 320px
//   panel. `^` reading as "to the power of" is the lesser evil. This is not a
//   special case in the code: it falls straight out of "a bare script run must
//   be alphanumeric". Authors who do want it raised can write `10^{P_tx/10}`.
//
// FALSE-POSITIVE GUARDS  (see `baseIsValid`)
// ------------------------------------------
// The decisive one: a script base must be a *single* Latin/Greek letter (or a
// standalone digit run) that is NOT itself preceded by a letter, digit or
// underscore. Math symbols are single glyphs — `P_RF`, `η_PA`, `G^T`, `I^a` —
// whereas snake_case identifiers are not: in `UI_TOKENS` the candidate base
// `I` is preceded by `U`, in `data_source` the `a` is preceded by `t`. So
// every screaming-snake constant and every snake_case word is rejected by the
// same rule that accepts every real symbol in the catalog, with no allow-list.
//
// CJK never triggers anything: the base class is Latin/Greek/digits only, and
// a script body must be ASCII alphanumeric, so neither side of a `_` can be a
// Chinese character.
//
// Text that is already correct Unicode (`σ²`, `N₀`, `log₂`) contains no `_` or
// `^` at all and is therefore never touched — the scanner's fast path returns
// the original string identity-unchanged when no marker is present.
//
// Owner: agent-R. No npm dependencies (CONTRACT §0.6) — this is a hand-rolled
// character scanner, not a parser library, and definitely not KaTeX.
import { Fragment, type CSSProperties, type ReactNode } from 'react';

/** A parsed run of popover copy. `text` is literal; `sub`/`sup` wrap children. */
export type InlineFormulaToken =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'sub'; readonly children: readonly InlineFormulaToken[] }
  | { readonly kind: 'sup'; readonly children: readonly InlineFormulaToken[] };

/**
 * Longest bare (unbraced) script run we will accept, e.g. `P_circuit` is 7.
 * A cap keeps a stray `_` in front of a long word from swallowing it even if
 * the base test somehow passed.
 */
const MAX_BARE_RUN = 12;
/** Longest `{...}` group we will accept. */
const MAX_BRACE_RUN = 32;
/** Max nesting of <sub>/<sup> elements. Deeper than this renders as literal text. */
const MAX_SCRIPT_DEPTH = 2;

/** Fast bail: strings with neither marker are returned untouched. */
const HAS_MARKER = /[_^]/;

/** Latin + Greek + Greek Extended. Deliberately excludes CJK. */
function isLetterish(ch: string): boolean {
  return /[A-Za-zͰ-Ͽἀ-῿]/.test(ch);
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/** Characters allowed inside a bare (unbraced) script run. */
function isScriptRunChar(ch: string): boolean {
  return isDigit(ch) || /[A-Za-z]/.test(ch);
}

/**
 * Is the character immediately before `markerIndex` a legitimate script base?
 *
 * Accepts a lone Latin/Greek letter, or a run of digits (so `10^…` works),
 * provided the character in front of it is not a letter, digit or underscore.
 * That single condition is what separates `P_RF` (base `P`, preceded by a
 * space) from `UI_TOKENS` (base `I`, preceded by `U`).
 *
 * Reads the raw input rather than the emitted-text buffer, so a base cannot be
 * "reset" by an intervening script: in `P_RFx_y` the second base `x` is still
 * seen as preceded by `F` and rejected.
 */
function baseIsValid(input: string, markerIndex: number): boolean {
  if (markerIndex === 0) return false;
  const last = input[markerIndex - 1];

  let startIndex: number;
  if (isDigit(last)) {
    let j = markerIndex - 1;
    while (j >= 0 && isDigit(input[j])) j -= 1;
    startIndex = j + 1;
  } else if (isLetterish(last)) {
    startIndex = markerIndex - 1;
  } else {
    return false;
  }

  if (startIndex === 0) return true;
  const before = input[startIndex - 1];
  return !(isLetterish(before) || isDigit(before) || before === '_');
}

interface ScriptMatch {
  readonly kind: 'sub' | 'sup';
  readonly children: readonly InlineFormulaToken[];
  /** Index just past the consumed script. */
  readonly end: number;
}

/**
 * Try to read one script starting at `index` (which must point at `_` or `^`).
 * Returns null whenever anything is even slightly off, in which case the caller
 * emits the marker as literal text — nothing is ever dropped.
 */
function readScript(input: string, index: number, depth: number): ScriptMatch | null {
  const marker = input[index];
  const kind: 'sub' | 'sup' = marker === '_' ? 'sub' : 'sup';
  const next = input[index + 1];
  if (next === undefined) return null;

  if (next === '{') {
    const close = input.indexOf('}', index + 2);
    if (close === -1) return null;
    const content = input.slice(index + 2, close);
    if (content.length === 0 || content.length > MAX_BRACE_RUN) return null;
    // No nesting of brace groups; a stray '{' inside means we do not understand
    // this and should keep our hands off it.
    if (content.includes('{')) return null;
    return { kind, children: parseChildren(content, depth), end: close + 1 };
  }

  if (!isScriptRunChar(next)) return null;
  let j = index + 1;
  while (j < input.length && isScriptRunChar(input[j])) j += 1;
  const content = input.slice(index + 1, j);
  if (content.length > MAX_BARE_RUN) return null;
  return { kind, children: parseChildren(content, depth), end: j };
}

function parseChildren(content: string, depth: number): readonly InlineFormulaToken[] {
  if (depth + 1 >= MAX_SCRIPT_DEPTH) return [{ kind: 'text', text: content }];
  return parseInlineFormula(content, depth + 1);
}

/**
 * Split popover copy into literal text and script tokens.
 *
 * Pure and total: it never throws, and the concatenated text of the result
 * equals the input minus exactly the `_` / `^` / `{` / `}` characters that were
 * consumed as markup. Anything it does not confidently understand comes back
 * as a `text` token, verbatim.
 */
export function parseInlineFormula(input: string, depth = 0): InlineFormulaToken[] {
  const tokens: InlineFormulaToken[] = [];
  let buffer = '';

  const flush = (): void => {
    if (buffer.length > 0) {
      tokens.push({ kind: 'text', text: buffer });
      buffer = '';
    }
  };

  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if ((ch === '_' || ch === '^') && baseIsValid(input, i)) {
      const first = readScript(input, i, depth);
      if (first !== null) {
        flush();
        tokens.push({ kind: first.kind, children: first.children });
        let end = first.end;
        // `X_a^b` / `X^b_a`: one of each kind may hang off the same base.
        const secondMarker = input[end];
        if (
          (secondMarker === '_' || secondMarker === '^') &&
          (secondMarker === '_' ? 'sub' : 'sup') !== first.kind
        ) {
          const second = readScript(input, end, depth);
          if (second !== null) {
            tokens.push({ kind: second.kind, children: second.children });
            end = second.end;
          }
        }
        i = end;
        continue;
      }
    }
    buffer += ch;
    i += 1;
  }

  flush();
  return tokens;
}

/** Flatten tokens back to plain text. Used by tests to prove nothing is eaten. */
export function flattenInlineFormula(tokens: readonly InlineFormulaToken[]): string {
  let out = '';
  for (const token of tokens) {
    out += token.kind === 'text' ? token.text : flattenInlineFormula(token.children);
  }
  return out;
}

/**
 * Compact debug form, e.g. `P[_RF] ＝ 10^(P[_tx]/10)`. Test-facing: it makes
 * VALUE assertions on real catalog strings readable in a diff.
 */
export function formatInlineFormulaTokens(tokens: readonly InlineFormulaToken[]): string {
  let out = '';
  for (const token of tokens) {
    if (token.kind === 'text') {
      out += token.text;
    } else {
      out += `[${token.kind === 'sub' ? '_' : '^'}${formatInlineFormulaTokens(token.children)}]`;
    }
  }
  return out;
}

// --- rendering --------------------------------------------------------

// Browser-default <sub>/<sup> are wrong for this panel in two ways: they use
// `font-size: smaller` (~0.83em, barely distinguishable from the body) and they
// keep the default line-height, so a raised box GROWS its line box. In a CJK
// paragraph at line-height 1.6 that shows up as one line of the popover sitting
// further from its neighbour than the rest — the ragged rhythm reads as a bug.
//
// The fix is the standard one: `line-height: 0` so the script cannot affect the
// line box at all, `vertical-align: baseline` to cancel the default shift, and
// an explicit relative offset instead.
//
// Sizes are chosen against the popover body (16px, line-height 1.6 => 25.6px
// line box, CJK glyphs ~16px tall):
//   0.78em -> 12.5px. Small enough to read unmistakably as a script next to
//   16px text, large enough to stay legible for `RF` / `tx` / `circuit` on the
//   dark panel. (0.7em would be 11.2px, which is under this panel's smallest
//   type token of 14px by too wide a margin.)
//   sup top -0.42em -> raised 5.2px, putting the script's cap height at ~14px
//   above the baseline, i.e. flush with the top of the surrounding CJK glyphs
//   rather than poking above them into the line above.
//   sub bottom -0.22em -> dropped 2.8px, which clears the Latin baseline
//   without reaching the ~8px of room under it; none of the catalog subscripts
//   (RF, PA, tx, t, total, circuit, HO, fs) carry a descender.
// Depth 2 gets a shallower 0.86em so a nested `X_{a_b}` does not compound down
// to an illegible ~9px.
const SCRIPT_FONT_SIZE_DEPTH_1 = '0.78em';
const SCRIPT_FONT_SIZE_DEPTH_2 = '0.86em';
const SUP_OFFSET = '-0.42em';
const SUB_OFFSET = '-0.22em';

function scriptStyle(kind: 'sub' | 'sup', depth: number): CSSProperties {
  const base: CSSProperties = {
    fontSize: depth >= 2 ? SCRIPT_FONT_SIZE_DEPTH_2 : SCRIPT_FONT_SIZE_DEPTH_1,
    lineHeight: 0,
    position: 'relative',
    verticalAlign: 'baseline',
  };
  return kind === 'sub' ? { ...base, bottom: SUB_OFFSET } : { ...base, top: SUP_OFFSET };
}

function renderTokens(tokens: readonly InlineFormulaToken[], depth: number): ReactNode[] {
  return tokens.map((token, index) => {
    if (token.kind === 'text') {
      return <Fragment key={index}>{token.text}</Fragment>;
    }
    const children = renderTokens(token.children, depth + 1);
    if (token.kind === 'sub') {
      return (
        <sub key={index} style={scriptStyle('sub', depth)}>
          {children}
        </sub>
      );
    }
    return (
      <sup key={index} style={scriptStyle('sup', depth)}>
        {children}
      </sup>
    );
  });
}

/**
 * Render popover copy with `_`/`^` turned into real `<sub>`/`<sup>`.
 *
 * Returns the input unchanged (same string, no wrapper) whenever there is
 * nothing to do, so callers that only ever pass prose pay nothing and the DOM
 * stays identical. Total by construction, and belt-and-braces wrapped: if the
 * scanner ever threw, the caller still gets the original text rather than a
 * blank popover.
 */
export function renderInlineFormula(text: string | undefined): ReactNode {
  if (text === undefined || text.length === 0) return text;
  if (!HAS_MARKER.test(text)) return text;
  try {
    const tokens = parseInlineFormula(text);
    if (tokens.length === 0) return text;
    if (tokens.length === 1 && tokens[0].kind === 'text') return tokens[0].text;
    return <>{renderTokens(tokens, 1)}</>;
  } catch {
    return text;
  }
}
