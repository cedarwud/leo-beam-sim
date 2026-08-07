/**
 * Structural DOM assertions for validator scripts.
 *
 * WHY THIS EXISTS
 * ---------------
 * Several UI gates used to pin their invariants to *literal user-visible English
 * copy* (`assertContains(text, 'Receive-side antenna gain in the SINR signal
 * path.')`). That made the gate a hostage of the copy: the moment the UI became
 * bilingual / student-facing, the only way to keep the gate green was to keep an
 * `aria-hidden` English shadow copy in the DOM purely to feed the validator.
 *
 * The invariants those gates protect are almost never *about the words*. They are
 * about STRUCTURE:
 *   - "G^R is a numerator term"            -> `data-formula-side="numerator"`
 *   - "G^R is not in the P_t control group"-> testid X is not a descendant of Y
 *   - "the noise floor is read-only"       -> `data-readonly="true"`
 *   - "the term grid still exposes S"      -> `data-term="signalDbm"`
 *   - "the slider comes before the notes"  -> document order of two testids
 *
 * This module gives those a first-class vocabulary so the gates can assert the
 * real thing, in a language the copy cannot break.
 *
 * SCOPE / non-goals
 * -----------------
 * These helpers operate on `renderToStaticMarkup` output — well-formed, quoted,
 * generated markup. They are deliberately regex/scanner based rather than a real
 * HTML parser: validator scripts must stay dependency-free and fast. They are NOT
 * a general-purpose HTML parser and should not be pointed at hand-written HTML.
 */

import assert from 'node:assert/strict';

/** Attribute literal as it appears in serialized markup, e.g. `data-x="y"`. */
function attrLiteral(attr: string, value: string): string {
  return `${attr}="${value}"`;
}

function describe(context?: string): string {
  return context ? ` (${context})` : '';
}

/**
 * Return the full outer markup of the element carrying `data-testid="<testId>"`.
 *
 * Fails loudly when the test id is absent or the element is unbalanced — an
 * absent hook is a real regression, never something to skip over.
 */
export function extractElementByTestId(markup: string, testId: string, context?: string): string {
  const attr = attrLiteral('data-testid', testId);
  const attrIndex = markup.indexOf(attr);
  assert.notEqual(attrIndex, -1, `expected markup to contain ${attr}${describe(context)}`);

  const start = markup.lastIndexOf('<', attrIndex);
  assert.notEqual(start, -1, `expected an opening tag for ${testId}${describe(context)}`);

  const tagMatch = /^<([a-zA-Z][\w:-]*)/.exec(markup.slice(start));
  assert.ok(tagMatch, `expected a tag name for ${testId}${describe(context)}`);
  const tagName = tagMatch[1];

  // Void elements never have a closing tag; their outer markup is the tag itself.
  const openTagEnd = markup.indexOf('>', start);
  assert.notEqual(openTagEnd, -1, `expected the opening tag of ${testId} to close${describe(context)}`);
  if (markup[openTagEnd - 1] === '/' || VOID_ELEMENTS.has(tagName.toLowerCase())) {
    return markup.slice(start, openTagEnd + 1);
  }

  const tagPattern = /<\/?([a-zA-Z][\w:-]*)(?:\s[^<>]*)?>/g;
  tagPattern.lastIndex = start;

  let depth = 0;
  for (let match = tagPattern.exec(markup); match !== null; match = tagPattern.exec(markup)) {
    const token = match[0];
    const name = match[1];
    if (name !== tagName) continue;

    if (token.startsWith('</')) {
      depth -= 1;
      if (depth === 0) return markup.slice(start, match.index + token.length);
    } else if (!token.endsWith('/>') && !VOID_ELEMENTS.has(name.toLowerCase())) {
      depth += 1;
    }
  }

  return assert.fail(`expected a closing tag for ${testId}${describe(context)}`);
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Return the full outer markup of the element carrying `attr="value"`.
 *
 * The `data-testid` variant covers most cases, but some grids identify their
 * cells by a semantic attribute instead (`data-term="signalDbm"`), which is a
 * better contract than a test id because it names the DOMAIN concept.
 */
export function extractElementByAttr(
  markup: string,
  attr: string,
  value: string,
  context?: string,
): string {
  const needle = attrLiteral(attr, value);
  const attrIndex = markup.indexOf(needle);
  assert.notEqual(attrIndex, -1, `expected markup to contain ${needle}${describe(context)}`);

  const start = markup.lastIndexOf('<', attrIndex);
  assert.notEqual(start, -1, `expected an opening tag for ${needle}${describe(context)}`);

  const tagMatch = /^<([a-zA-Z][\w:-]*)/.exec(markup.slice(start));
  assert.ok(tagMatch, `expected a tag name for ${needle}${describe(context)}`);
  const tagName = tagMatch[1];

  const openTagEnd = markup.indexOf('>', start);
  assert.notEqual(openTagEnd, -1, `expected the opening tag of ${needle} to close${describe(context)}`);
  if (markup[openTagEnd - 1] === '/' || VOID_ELEMENTS.has(tagName.toLowerCase())) {
    return markup.slice(start, openTagEnd + 1);
  }

  const tagPattern = /<\/?([a-zA-Z][\w:-]*)(?:\s[^<>]*)?>/g;
  tagPattern.lastIndex = start;

  let depth = 0;
  for (let match = tagPattern.exec(markup); match !== null; match = tagPattern.exec(markup)) {
    const token = match[0];
    const name = match[1];
    if (name !== tagName) continue;

    if (token.startsWith('</')) {
      depth -= 1;
      if (depth === 0) return markup.slice(start, match.index + token.length);
    } else if (!token.endsWith('/>') && !VOID_ELEMENTS.has(name.toLowerCase())) {
      depth += 1;
    }
  }

  return assert.fail(`expected a closing tag for ${needle}${describe(context)}`);
}

/**
 * Assert a numeric/unit token renders inside the element identified by
 * `attr="value"` — e.g. "the receiverGain cell shows 2.5 dBi", which is strictly
 * stronger than "2.5 dBi appears somewhere on the page".
 */
export function assertValueInAttrElement(
  markup: string,
  attr: string,
  value: string,
  valueToken: string,
  context?: string,
): void {
  assert.ok(
    /^[-+0-9]/.test(valueToken),
    `assertValueInAttrElement is for numeric/unit tokens only; got "${valueToken}"`,
  );
  const text = decodeHtmlText(extractElementByAttr(markup, attr, value, context));
  assert.ok(
    text.includes(valueToken),
    `expected ${attr}="${value}" to render the value "${valueToken}"; text was "${text}"${describe(context)}`,
  );
}

/** The opening tag (`<div ...>`) of the element carrying `data-testid="<testId>"`. */
export function openingTagOfTestId(markup: string, testId: string, context?: string): string {
  const element = extractElementByTestId(markup, testId, context);
  const end = element.indexOf('>');
  assert.notEqual(end, -1, `expected an opening tag for ${testId}${describe(context)}`);
  return element.slice(0, end + 1);
}

/** Every `data-testid` value present in `markup`, in document order (with duplicates). */
export function testIdsIn(markup: string): string[] {
  return [...markup.matchAll(/data-testid="([^"]*)"/g)].map(match => match[1]);
}

/** Every value of `attr` present in `markup`, in document order (with duplicates). */
export function attrValuesIn(markup: string, attr: string): string[] {
  return [...markup.matchAll(new RegExp(`${attr}="([^"]*)"`, 'g'))].map(match => match[1]);
}

/** Assert `data-testid="<testId>"` is present somewhere in `markup`. */
export function assertTestId(markup: string, testId: string, context?: string): void {
  assert.ok(
    markup.includes(attrLiteral('data-testid', testId)),
    `expected data-testid="${testId}" to be present${describe(context)}`,
  );
}

/** Assert `data-testid="<testId>"` is absent from `markup`. */
export function assertNoTestId(markup: string, testId: string, context?: string): void {
  assert.ok(
    !markup.includes(attrLiteral('data-testid', testId)),
    `expected data-testid="${testId}" to be absent${describe(context)}`,
  );
}

/** Assert every id in `testIds` is present. */
export function assertTestIds(markup: string, testIds: readonly string[], context?: string): void {
  for (const testId of testIds) assertTestId(markup, testId, context);
}

/** Assert every id in `testIds` is absent. */
export function assertNoTestIds(markup: string, testIds: readonly string[], context?: string): void {
  for (const testId of testIds) assertNoTestId(markup, testId, context);
}

/**
 * Assert `descendantTestId` renders INSIDE the subtree of `ancestorTestId`.
 *
 * This is the structural form of "term X belongs to control group Y" — the thing
 * copy assertions like `assertContains(receiverGroupText, 'Receiver gain')` were
 * really trying (and failing) to say.
 */
export function assertContainsTestId(
  markup: string,
  ancestorTestId: string,
  descendantTestId: string,
  context?: string,
): void {
  const subtree = extractElementByTestId(markup, ancestorTestId, context);
  assert.ok(
    subtree.includes(attrLiteral('data-testid', descendantTestId)),
    `expected "${descendantTestId}" to render inside "${ancestorTestId}"${describe(context)}`,
  );
}

/** Assert `descendantTestId` does NOT render inside the subtree of `ancestorTestId`. */
export function assertNotContainsTestId(
  markup: string,
  ancestorTestId: string,
  descendantTestId: string,
  context?: string,
): void {
  const subtree = extractElementByTestId(markup, ancestorTestId, context);
  assert.ok(
    !subtree.includes(attrLiteral('data-testid', descendantTestId)),
    `expected "${descendantTestId}" NOT to render inside "${ancestorTestId}"${describe(context)}`,
  );
}

/** Assert `attr="value"` appears somewhere in `markup`. */
export function assertAttr(markup: string, attr: string, value: string, context?: string): void {
  assert.ok(
    markup.includes(attrLiteral(attr, value)),
    `expected ${attrLiteral(attr, value)} to be present${describe(context)}`,
  );
}

/** Assert `attr="value"` appears nowhere in `markup`. */
export function assertNoAttr(markup: string, attr: string, value: string, context?: string): void {
  assert.ok(
    !markup.includes(attrLiteral(attr, value)),
    `expected ${attrLiteral(attr, value)} to be absent${describe(context)}`,
  );
}

/**
 * Assert the element carrying `data-testid="<testId>"` itself carries
 * `attr="value"` on its OWN opening tag (not merely somewhere in its subtree).
 */
export function assertTestIdAttr(
  markup: string,
  testId: string,
  attr: string,
  value: string,
  context?: string,
): void {
  const openTag = openingTagOfTestId(markup, testId, context);
  assert.ok(
    openTag.includes(attrLiteral(attr, value)),
    `expected element "${testId}" to carry ${attrLiteral(attr, value)}; opening tag was ${openTag}${describe(context)}`,
  );
}

/** Assert the element carrying `data-testid="<testId>"` does NOT carry `attr="value"`. */
export function assertNotTestIdAttr(
  markup: string,
  testId: string,
  attr: string,
  value: string,
  context?: string,
): void {
  const openTag = openingTagOfTestId(markup, testId, context);
  assert.ok(
    !openTag.includes(attrLiteral(attr, value)),
    `expected element "${testId}" NOT to carry ${attrLiteral(attr, value)}${describe(context)}`,
  );
}

/**
 * Assert the given test ids appear in this relative document order.
 *
 * Used where the invariant is "the editable control is the primary action and the
 * explanatory context is the footnote below it" — an ordering fact, which copy
 * assertions could only approximate.
 */
export function assertTestIdOrder(markup: string, testIds: readonly string[], context?: string): void {
  let previousIndex = -1;
  let previousId = '<start of document>';
  for (const testId of testIds) {
    const index = markup.indexOf(attrLiteral('data-testid', testId));
    assert.notEqual(index, -1, `expected data-testid="${testId}" to be present${describe(context)}`);
    assert.ok(
      index > previousIndex,
      `expected "${testId}" to render after "${previousId}"${describe(context)}`,
    );
    previousIndex = index;
    previousId = testId;
  }
}

/**
 * Assert exactly `count` elements carry `attr="value"`.
 *
 * Guards "there is one and only one X" invariants (single serving column, single
 * noise-floor readout) without naming any copy.
 */
export function assertAttrCount(
  markup: string,
  attr: string,
  value: string,
  count: number,
  context?: string,
): void {
  const actual = attrValuesIn(markup, attr).filter(entry => entry === value).length;
  assert.equal(
    actual,
    count,
    `expected exactly ${count} element(s) with ${attrLiteral(attr, value)}, found ${actual}${describe(context)}`,
  );
}

/**
 * Assert a numeric/unit token is rendered inside the subtree of `testId`.
 *
 * Numbers and unit symbols (`dB`, `dBm`, `dBi`, `MHz`) are NOT natural-language
 * copy — they survive translation unchanged — so pinning them stays legitimate.
 * Use this instead of pinning the surrounding English sentence.
 */
export function assertValueInTestId(
  markup: string,
  testId: string,
  valueToken: string,
  context?: string,
): void {
  assert.ok(
    /^[-+0-9]/.test(valueToken),
    `assertValueInTestId is for numeric/unit tokens only; got "${valueToken}"`,
  );
  const subtree = extractElementByTestId(markup, testId, context);
  const text = decodeHtmlText(subtree);
  assert.ok(
    text.includes(valueToken),
    `expected "${testId}" to render the value "${valueToken}"; text was "${text}"${describe(context)}`,
  );
}

/**
 * Strip markup down to visible text. Shared by validators that still need a text
 * view (for numeric readouts, or for NEGATIVE copy bans that must stay).
 */
export function decodeHtmlText(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
