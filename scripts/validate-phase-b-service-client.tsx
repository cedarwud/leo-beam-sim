#!/usr/bin/env node
// validate-phase-b-service-client.tsx
//
// PR-epsilon acceptance validator:
//   (a) probeService reports reachable=true on 200 OK with version JSON
//   (b) probeService reports reachable=false on 503
//   (c) probeService reports reachable=false on network error
//   (d) probeService timeout reports reachable=false with timeout message
//   (e) training service base URL localStorage helper falls back and round-trips
//   (f) ServiceStatusBanner is mounted inside App.tsx right sidebar
//   (g) ServiceStatusBanner is mode-gated and does not hard-code the default URL
//
// Run: node --import tsx/esm scripts/validate-phase-b-service-client.tsx

import * as fs from 'node:fs';
import {
  DEFAULT_TRAINING_SERVICE_BASE_URL,
  persistTrainingServiceBaseUrl,
  readTrainingServiceBaseUrl,
} from '../src/modqn/training-trigger/baseUrl';
import { probeService } from '../src/modqn/training-trigger/serviceClient';

let passed = 0;
let failed = 0;

function pass(label: string): void {
  console.log(`  [PASS] ${label}`);
  passed++;
}

function fail(label: string, detail?: string): void {
  console.error(`  [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
  failed++;
}

function assert(cond: boolean, label: string, detail?: string): void {
  if (cond) {
    pass(label);
  } else {
    fail(label, detail);
  }
}

function withFetch<T>(stub: typeof fetch, action: () => Promise<T> | T): Promise<T> {
  const original = (globalThis as any).fetch;
  (globalThis as any).fetch = stub;
  return Promise.resolve(action()).finally(() => {
    if (original === undefined) {
      delete (globalThis as any).fetch;
    } else {
      (globalThis as any).fetch = original;
    }
  });
}

// ---------------------------------------------------------------------------
// (a) probeService: reachable: true on 200 OK with JSON body
// ---------------------------------------------------------------------------
console.log('\n(a) probeService reachable on 200 OK');
await withFetch(
  (async () => ({
    ok: true,
    status: 200,
    json: async () => ({ version: 'modqn-training-service@0.1.0' }),
  }) as Response) as typeof fetch,
  async () => {
    const result = await probeService({ baseUrl: 'http://test.local:8765', probeTimeoutMs: 100 });
    assert(result.reachable === true, 'probeService returns reachable=true on 200 OK');
    assert(
      result.version === 'modqn-training-service@0.1.0',
      'probeService reads version from health JSON',
      `got ${result.version}`,
    );
    assert(
      typeof result.latencyMs === 'number' && Number.isFinite(result.latencyMs) && result.latencyMs >= 0,
      'probeService reports finite non-negative latency',
      `got ${result.latencyMs}`,
    );
  },
);

// ---------------------------------------------------------------------------
// (b) probeService: reachable: false on 503
// ---------------------------------------------------------------------------
console.log('\n(b) probeService unreachable on 503');
await withFetch(
  (async () => ({
    ok: false,
    status: 503,
    json: async () => ({}),
  }) as Response) as typeof fetch,
  async () => {
    const result = await probeService({ baseUrl: 'http://test.local:8765', probeTimeoutMs: 100 });
    assert(result.reachable === false, 'probeService returns reachable=false on 503');
    assert(result.error === 'HTTP 503', 'probeService reports HTTP 503 error', `got ${result.error}`);
  },
);

// ---------------------------------------------------------------------------
// (c) probeService: reachable: false on network error
// ---------------------------------------------------------------------------
console.log('\n(c) probeService unreachable on network error');
await withFetch(
  (async () => {
    throw new Error('ECONNREFUSED');
  }) as typeof fetch,
  async () => {
    const result = await probeService({ baseUrl: 'http://test.local:8765', probeTimeoutMs: 100 });
    assert(result.reachable === false, 'probeService returns reachable=false on network error');
    assert(
      typeof result.error === 'string' && result.error.includes('ECONNREFUSED'),
      'probeService reports network error text',
      `got ${result.error}`,
    );
  },
);

// ---------------------------------------------------------------------------
// (d) probeService: timeout produces reachable: false with timeout message
// ---------------------------------------------------------------------------
console.log('\n(d) probeService timeout');
await withFetch(
  ((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(typeof DOMException !== 'undefined'
        ? new DOMException('aborted', 'AbortError')
        : Object.assign(new Error('aborted'), { name: 'AbortError' }));
    });
  })) as typeof fetch,
  async () => {
    const result = await probeService({ baseUrl: 'http://test.local', probeTimeoutMs: 50 });
    assert(result.reachable === false, 'probeService returns reachable=false on timeout');
    assert(
      typeof result.error === 'string' && result.error.includes('timed out'),
      'probeService timeout error includes timed out',
      `got ${result.error}`,
    );
  },
);

// ---------------------------------------------------------------------------
// (e) baseUrl: localStorage round-trip with default fallback
// ---------------------------------------------------------------------------
console.log('\n(e) baseUrl localStorage round-trip');
{
  const originalWindow = (globalThis as any).window;
  const store = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    },
  };

  try {
    assert(
      readTrainingServiceBaseUrl() === DEFAULT_TRAINING_SERVICE_BASE_URL,
      'readTrainingServiceBaseUrl returns default before write',
      readTrainingServiceBaseUrl(),
    );
    persistTrainingServiceBaseUrl('http://10.0.0.5:9000');
    assert(
      readTrainingServiceBaseUrl() === 'http://10.0.0.5:9000',
      'persistTrainingServiceBaseUrl round-trips override',
      readTrainingServiceBaseUrl(),
    );
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  }
}

// ---------------------------------------------------------------------------
// (f) source grep: banner mounted in App.tsx leo-shell-right aside
// ---------------------------------------------------------------------------
console.log('\n(f) App.tsx right-sidebar mount');
{
  const appSource = fs.readFileSync('src/App.tsx', 'utf8');
  assert(
    appSource.includes("import { ServiceStatusBanner } from './ui/modqn-training/ServiceStatusBanner';"),
    'App.tsx imports ServiceStatusBanner',
  );
  assert(
    appSource.includes('<ServiceStatusBanner appMode={appMode} />'),
    'App.tsx mounts ServiceStatusBanner with appMode',
  );

  const asideIndex = appSource.indexOf('<aside className="leo-shell-right"');
  const bannerIndex = appSource.indexOf('<ServiceStatusBanner', asideIndex);
  const sidebarIndex = appSource.indexOf('<SidebarTabShell', asideIndex);
  assert(
    asideIndex >= 0 && bannerIndex > asideIndex && sidebarIndex > bannerIndex,
    'ServiceStatusBanner appears after leo-shell-right aside and before SidebarTabShell',
    `aside=${asideIndex}, banner=${bannerIndex}, sidebar=${sidebarIndex}`,
  );
}

// ---------------------------------------------------------------------------
// (g) source grep: banner has mode gate + useEffect early-return
// ---------------------------------------------------------------------------
console.log('\n(g) ServiceStatusBanner mode gate');
{
  const bannerSource = fs.readFileSync('src/ui/modqn-training/ServiceStatusBanner.tsx', 'utf8');
  assert(
    bannerSource.includes("appMode === 'modqn-demo'"),
    'ServiceStatusBanner gates on modqn-demo app mode',
  );
  assert(
    bannerSource.includes('if (!enabled) return;'),
    'ServiceStatusBanner useEffect has enabled early return',
  );
  assert(
    bannerSource.includes('data-testid="service-status-banner-unreachable"'),
    'ServiceStatusBanner exposes unreachable test id',
  );
  assert(
    !bannerSource.includes('http://127.0.0.1:8765'),
    'ServiceStatusBanner does not hard-code default backend URL',
  );
}

console.log(`\n[validate-phase-b-service-client] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
