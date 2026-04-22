import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface UiState {
  selectedProfileId: string | null;
  selectedProfileLabel: string | null;
  formulaFamilyLabel: string | null;
  profileIdLabel: string | null;
  beamHoppingState: string | null;
  bodyText: string;
}

interface CdpResponse {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
}

class CdpClient {
  private socket: WebSocket;
  private nextId = 0;
  private pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private eventWaiters = new Map<string, Array<(params: unknown) => void>>();

  constructor(private readonly wsUrl: string) {
    this.socket = new WebSocket(wsUrl);
  }

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const handleOpen = () => resolve();
      const handleError = (event: Event) => reject(new Error(`Failed to open CDP socket: ${event.type}`));
      this.socket.addEventListener('open', handleOpen, { once: true });
      this.socket.addEventListener('error', handleError, { once: true });
      this.socket.addEventListener('message', event => {
        this.handleMessage(String(event.data));
      });
    });
  }

  async send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP method timed out: ${method}`));
      }, 5000);

      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitForEvent(method: string, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for CDP event: ${method}`));
      }, timeoutMs);
      const waiter = (params: unknown) => {
        clearTimeout(timer);
        resolve(params);
      };
      const waiters = this.eventWaiters.get(method) ?? [];
      waiters.push(waiter);
      this.eventWaiters.set(method, waiters);
    });
  }

  async close(): Promise<void> {
    if (this.socket.readyState === this.socket.CLOSED) return;
    await new Promise<void>(resolve => {
      this.socket.addEventListener('close', () => resolve(), { once: true });
      this.socket.close();
    });
  }

  private handleMessage(raw: string): void {
    const message = JSON.parse(raw) as CdpResponse;

    if (typeof message.id === 'number') {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(new Error(message.error.message ?? 'Unknown CDP error'));
        return;
      }
      pending.resolve(message.result);
      return;
    }

    if (!message.method) return;
    const waiters = this.eventWaiters.get(message.method);
    if (!waiters || waiters.length === 0) return;
    this.eventWaiters.set(message.method, []);
    for (const waiter of waiters) {
      waiter(message.params);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function resolveAppUrl(): Promise<string> {
  const explicitUrl = process.argv[2];
  const candidates = explicitUrl
    ? [explicitUrl]
    : [
      'http://127.0.0.1:4174/',
      'http://127.0.0.1:4173/',
      'http://127.0.0.1:5173/',
    ];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) continue;
      const html = await response.text();
      if (html.includes('<title>LEO Beam Sim</title>')) {
        return candidate;
      }
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(
    explicitUrl
      ? `Could not reach a LEO Beam Sim dev server at ${explicitUrl}`
      : 'Could not find a running LEO Beam Sim dev server on 4174, 4173, or 5173',
  );
}

async function waitFor<T>(
  description: string,
  fn: () => Promise<T | null>,
  timeoutMs = 5000,
): Promise<T> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await fn();
    if (result !== null) return result;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function evaluate<T>(client: CdpClient, expression: string): Promise<T> {
  const response = await client.send<{
    result: { value?: T };
    exceptionDetails?: { text?: string };
  }>('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text ?? 'Runtime.evaluate failed');
  }
  return response.result.value as T;
}

async function readUiState(client: CdpClient): Promise<UiState> {
  return evaluate<UiState>(client, `(() => {
    const select = document.querySelector('select');
    const option = select instanceof HTMLSelectElement
      ? Array.from(select.options).find(candidate => candidate.value === select.value) ?? null
      : null;
    const lines = document.body.innerText
      .split('\\n')
      .map(line => line.trim())
      .filter(Boolean);
    const readAfter = (label, offset = 1) => {
      const index = lines.indexOf(label);
      return index >= 0 ? lines[index + offset] ?? null : null;
    };

    return {
      selectedProfileId: select instanceof HTMLSelectElement ? select.value : null,
      selectedProfileLabel: option ? option.textContent?.trim() ?? null : null,
      formulaFamilyLabel: readAfter('SIGNAL PROFILE', 1),
      profileIdLabel: readAfter('SIGNAL PROFILE', 2),
      beamHoppingState: readAfter('BEAM HOPPING', 1),
      bodyText: lines.join('\\n'),
    };
  })()`);
}

async function switchProfile(client: CdpClient, profileId: string): Promise<void> {
  const result = await evaluate<{ ok: boolean; value: string | null }>(client, `(() => {
    const select = document.querySelector('select');
    if (!(select instanceof HTMLSelectElement)) {
      return { ok: false, value: null };
    }
    select.value = ${JSON.stringify(profileId)};
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value: select.value };
  })()`);
  assert.equal(result.ok, true, 'profile selector should exist');
}

async function launchChrome(remoteDebuggingPort: number, userDataDir: string) {
  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], {
    stdio: 'ignore',
  });

  await waitFor(
    'Chrome remote debugging endpoint',
    async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${remoteDebuggingPort}/json/list`);
        return response.ok ? true : null;
      } catch {
        return null;
      }
    },
    5000,
  );

  return chrome;
}

async function terminateChrome(chrome: ReturnType<typeof spawn>): Promise<void> {
  if (chrome.exitCode !== null) return;

  await new Promise<void>(resolve => {
    chrome.once('close', () => resolve());
    chrome.kill('SIGTERM');
  });
}

async function main(): Promise<void> {
  const appUrl = await resolveAppUrl();
  const remoteDebuggingPort = 9322;
  const userDataDir = await mkdtemp(join(tmpdir(), 'leo-beam-sim-browser-qa-'));
  let chrome: ReturnType<typeof spawn> | null = null;
  let client: CdpClient | null = null;

  try {
    chrome = await launchChrome(remoteDebuggingPort, userDataDir);

    const targets = await fetch(`http://127.0.0.1:${remoteDebuggingPort}/json/list`)
      .then(response => response.json()) as Array<{ type?: string; webSocketDebuggerUrl?: string }>;
    const pageTarget = targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl);
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error('Could not resolve a page target from Chrome remote debugging');
    }

    client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    const loadEvent = client.waitForEvent('Page.loadEventFired', 5000);
    await client.send('Page.navigate', { url: appUrl });
    await loadEvent;

    const initialState = await waitFor(
      'initial candidate-rich panel',
      async () => {
        const state = await readUiState(client!);
        return state.profileIdLabel === 'hobs-2024-candidate-rich' ? state : null;
      },
    );
    assert.equal(initialState.selectedProfileId, 'hobs-2024-candidate-rich');
    assert.equal(initialState.formulaFamilyLabel, 'HOBS Legacy');
    assert.equal(initialState.beamHoppingState, 'ON');

    await switchProfile(client, 'hobs-2024-tr38811-research');
    const researchState = await waitFor(
      'research profile panel',
      async () => {
        const state = await readUiState(client!);
        return state.profileIdLabel === 'hobs-2024-tr38811-research' ? state : null;
      },
    );
    assert.equal(researchState.selectedProfileId, 'hobs-2024-tr38811-research');
    assert.equal(researchState.formulaFamilyLabel, 'HOBS + TR 38.811');
    assert.equal(researchState.beamHoppingState, 'OFF');

    await switchProfile(client, 'hobs-2024-candidate-rich');
    const resetState = await waitFor(
      'candidate-rich reset panel',
      async () => {
        const state = await readUiState(client!);
        return state.profileIdLabel === 'hobs-2024-candidate-rich' ? state : null;
      },
    );
    assert.equal(resetState.formulaFamilyLabel, 'HOBS Legacy');
    assert.equal(resetState.beamHoppingState, 'ON');

    await switchProfile(client, 'hobs-2024-tr38811-research');
    const researchRepeatState = await waitFor(
      'research profile after reset',
      async () => {
        const state = await readUiState(client!);
        return state.profileIdLabel === 'hobs-2024-tr38811-research' ? state : null;
      },
    );
    assert.equal(researchRepeatState.formulaFamilyLabel, 'HOBS + TR 38.811');
    assert.equal(researchRepeatState.beamHoppingState, 'OFF');

    console.log(JSON.stringify({
      appUrl,
      states: {
        initialState,
        researchState,
        resetState,
        researchRepeatState,
      },
    }, null, 2));
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
    if (chrome) {
      await terminateChrome(chrome).catch(() => {});
    }
    await sleep(100);
    await rm(userDataDir, { recursive: true, force: true }).catch(async () => {
      await sleep(250);
      await rm(userDataDir, { recursive: true, force: true });
    });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
