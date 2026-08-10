import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { C120_CLAIM_BOUNDARY } from './contract';
import { C120_FIXTURE_PROVIDER } from './fixtures';
import { C120EvidenceLedger } from './C120EvidenceLedger';
import { C120LocaleProvider } from './i18n';

const scenario = C120_FIXTURE_PROVIDER.getScenario();
const replay = scenario.labA.replays[0];
if (replay === undefined) throw new Error('fixture test requires a Lab A replay');

test('C120EvidenceLedger renders an empty, disclosed state without a replay', () => {
  const html = renderToStaticMarkup(<C120LocaleProvider initialLocale="en"><C120EvidenceLedger replay={null} /></C120LocaleProvider>);
  assert.match(html, /data-testid="c120-evidence-ledger-empty"/);
  assert.match(html, /No result data is available yet/);
  assert.match(html, new RegExp(C120_CLAIM_BOUNDARY.replace(/\//g, '\\/')));
});

test('C120EvidenceLedger is Traditional-Chinese-first for learners', () => {
  const html = renderToStaticMarkup(<C120EvidenceLedger replay={null} />);
  assert.match(html, /結果的數值證據/);
  assert.match(html, /還沒有結果資料/);
});

test('C120EvidenceLedger renders provider values, units, identity, and accessible ledger structure', () => {
  const html = renderToStaticMarkup(
    <C120LocaleProvider initialLocale="en"><C120EvidenceLedger replay={replay} currentFrameIndex={1} ledgerDefaultOpen /></C120LocaleProvider>,
  );

  assert.match(html, /data-testid="c120-evidence-ledger"/);
  assert.match(html, /data-testid="c120-evidence-ledger-current-outcome"/);
  assert.match(html, new RegExp(C120_CLAIM_BOUNDARY.replace(/\//g, '\\/')));
  assert.match(html, new RegExp(`data-scenario-id="${scenario.manifest.scenario.scenarioId}"`));
  assert.match(html, new RegExp(`data-replay-id="${replay.replayId}"`));
  assert.match(html, /<details[^>]*open=""/);
  assert.match(html, /<summary>Show synchronized frame ledger \(2 frames\)<\/summary>/);
  assert.match(html, /<table class="c120-evidence-ledger__table">/);
  assert.match(html, /<caption>Course-provided values/);
  assert.match(html, /scope="col">Elapsed \(s\)/);
  assert.match(html, /scope="col">Power \(W\)/);
  assert.match(html, /scope="col">Consumed \(J\)/);
  assert.match(html, /scope="col">Delivered \(bit\)/);
  assert.match(html, /scope="col">bit\/J \(bit\/J\)/i);
  assert.match(html, /scope="row"/);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /data-current-frame="true"/);
  assert.match(html, /data-unit="J"/);
  assert.match(html, /data-unit="bit\/J"/);
  assert.match(html, /data-provenance="frame-identity"/);
  assert.match(html, /high-idle-cost/);
});

test('C120EvidenceLedger exposes a keyboard-selectable synchronized frame control', () => {
  const selected: number[] = [];
  const html = renderToStaticMarkup(
    <C120LocaleProvider initialLocale="en">
      <C120EvidenceLedger
        replay={replay}
        currentFrameIndex={0}
        onFrameSelect={frameIndex => selected.push(frameIndex)}
      />
    </C120LocaleProvider>,
  );

  assert.match(html, /class="c120-evidence-ledger__frame-button"/);
  assert.match(html, /aria-label="Show replay frame 1, elapsed 0 s"/);
  assert.match(html, /aria-label="Show replay frame 2, elapsed 32 s"/);
  assert.match(html, /<div class="c120-evidence-ledger__table-scroll" tabindex="0"/);
  assert.deepEqual(selected, []);
});

console.log('C-120 evidence ledger tests passed');
