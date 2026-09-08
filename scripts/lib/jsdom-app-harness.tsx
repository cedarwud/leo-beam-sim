import { JSDOM } from 'jsdom';
import React from 'react';
import type { Root } from 'react-dom/client';

type WaitOptions = { readonly timeout?: number; readonly polling?: number; readonly state?: 'attached' | 'visible' };

const WINDOW_GLOBALS = [
  'window', 'document', 'navigator', 'screen', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node',
  'Event', 'MouseEvent', 'KeyboardEvent', 'CustomEvent', 'MutationObserver', 'DOMParser', 'getComputedStyle',
  'HTMLInputElement', 'HTMLOptionElement', 'HTMLSelectElement', 'HTMLButtonElement', 'HTMLTextAreaElement',
  'SVGElement', 'Blob', 'File', 'FormData', 'AbortController', 'EventTarget', 'Text', 'ShadowRoot',
  'localStorage', 'sessionStorage',
] as const;

function exposeWindow(window: Window & typeof globalThis, reducedMotion = false): void {
  for (const key of WINDOW_GLOBALS) {
    Object.defineProperty(globalThis, key, { configurable: true, value: window[key as keyof typeof window] });
  }

  Object.defineProperty(window, 'fetch', { configurable: true, value: globalThis.fetch });
  Object.defineProperty(window, 'URLSearchParams', { configurable: true, value: globalThis.URLSearchParams });
  Object.defineProperty(window, 'performance', { configurable: true, value: globalThis.performance });
  window.matchMedia = query => ({
    matches: reducedMotion && query.includes('prefers-reduced-motion'),
    media: '',
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  });
  window.scrollTo = () => {};

  const requestAnimationFrame = (callback: FrameRequestCallback): number => (
    setTimeout(() => callback(Date.now()), 16) as unknown as number
  );
  const cancelAnimationFrame = (id: number): void => clearTimeout(id);
  window.requestAnimationFrame = requestAnimationFrame;
  window.cancelAnimationFrame = cancelAnimationFrame;
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: requestAnimationFrame });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: cancelAnimationFrame });

  class NoopObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: NoopObserver });
  Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, value: NoopObserver });
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: NoopObserver });
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: NoopObserver });
}

function formatConsoleArgument(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function isReactWarning(args: readonly unknown[]): boolean {
  const message = args.map(formatConsoleArgument).join(' ');
  return /Each child in a list|incorrect casing|does not recognize the|unrecognized in this browser|validateDOMNesting/i.test(message);
}

export interface DomLocator {
  count(): Promise<number>;
  first(): DomLocator;
  locator(selector: string): DomLocator;
  getAttribute(name: string): Promise<string | null>;
  click(): Promise<void>;
  check(): Promise<void>;
  fill(value: string): Promise<void>;
  selectOption(value: string): Promise<void>;
  inputValue(): Promise<string>;
  isEnabled(): Promise<boolean>;
  innerText(): Promise<string>;
  evaluate<T>(fn: (element: Element) => T): Promise<T>;
  evaluateAll<T>(fn: (elements: Element[]) => T): Promise<T>;
  waitFor(options?: WaitOptions): Promise<void>;
}

class JsdomLocator implements DomLocator {
  public constructor(
    private readonly document: Document,
    private readonly selector: string,
    private readonly root: ParentNode = document,
    private readonly index: number | null = null,
  ) {}

  private elements(): Element[] {
    const elements = [...this.root.querySelectorAll(this.selector)];
    return this.index === null ? elements : (elements[this.index] ? [elements[this.index]] : []);
  }

  private element(): Element {
    const element = this.elements()[0];
    if (!element) throw new Error(`DOM locator found no element: ${this.selector}`);
    return element;
  }

  async count(): Promise<number> { return this.elements().length; }

  first(): DomLocator { return new JsdomLocator(this.document, this.selector, this.root, 0); }

  locator(selector: string): DomLocator {
    return new JsdomLocator(this.document, selector, this.element());
  }

  async getAttribute(name: string): Promise<string | null> { return this.element().getAttribute(name); }

  async click(): Promise<void> {
    const element = this.element() as HTMLElement;
    element.click();
    await flushDom();
  }

  async check(): Promise<void> {
    const element = this.element();
    if (
      !(element instanceof HTMLInputElement)
      || (element.type !== 'checkbox' && element.type !== 'radio')
    ) {
      throw new Error(`DOM locator is not a checkbox or radio: ${this.selector}`);
    }
    if (!element.checked) element.click();
    await flushDom();
  }

  async fill(value: string): Promise<void> {
    const element = this.element();
    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
      throw new Error(`DOM locator is not fillable: ${this.selector}`);
    }
    const prototype = Object.getPrototypeOf(element) as { value?: PropertyDescriptor };
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    await flushDom();
  }

  async selectOption(value: string): Promise<void> {
    const element = this.element();
    if (!(element instanceof HTMLSelectElement)) throw new Error(`DOM locator is not a select: ${this.selector}`);
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    await flushDom();
  }

  async inputValue(): Promise<string> {
    const element = this.element() as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    return element.value;
  }

  async isEnabled(): Promise<boolean> {
    return !(this.element() as HTMLInputElement).disabled;
  }

  async innerText(): Promise<string> { return this.element().textContent ?? ''; }

  async evaluate<T>(fn: (element: Element) => T): Promise<T> { return fn(this.element()); }

  async evaluateAll<T>(fn: (elements: Element[]) => T): Promise<T> { return fn(this.elements()); }

  async waitFor(options: WaitOptions = {}): Promise<void> {
    await waitForDom(() => {
      const element = this.elements()[0];
      if (options.state === 'visible') return element !== undefined && !(element as HTMLElement).hidden;
      return element !== undefined;
    }, options.timeout ?? 30_000, `locator ${this.selector}`);
  }
}

export interface DomFunctionHandle<T> {
  jsonValue(): Promise<T>;
}

export class JsdomPage {
  public constructor(public readonly document: Document) {}

  locator(selector: string): DomLocator { return new JsdomLocator(this.document, selector); }

  async getAttribute(selector: string, name: string): Promise<string | null> {
    return this.locator(selector).getAttribute(name);
  }

  async click(selector: string): Promise<void> { await this.locator(selector).click(); }

  async waitForSelector(selector: string, options: WaitOptions = {}): Promise<void> {
    await this.locator(selector).waitFor(options);
  }

  async waitForFunction<T, A = undefined>(
    fn: (argument: A) => T | Promise<T>,
    argument?: A,
    options: WaitOptions = {},
  ): Promise<DomFunctionHandle<Awaited<T>>> {
    let result: Awaited<T> | undefined;
    await waitForDom(async () => {
      result = await fn(argument as A);
      return Boolean(result);
    }, options.timeout ?? 30_000, 'waitForFunction', options.polling ?? 25);
    const resolved = result as Awaited<T>;
    return { jsonValue: async (): Promise<Awaited<T>> => resolved };
  }

  async evaluate<T, A = undefined>(fn: (argument: A) => T, argument?: A): Promise<T> {
    return fn(argument as A);
  }

  async waitForTimeout(milliseconds: number): Promise<void> { await flushDom(milliseconds); }

  async goto(): Promise<void> { await flushDom(); }

  on(): void {}

  async close(): Promise<void> {}
}

export interface MountedJsdomApp {
  readonly dom: JSDOM;
  readonly page: JsdomPage;
  readonly errors: string[];
  readonly requests: string[];
  close(): void;
}

export interface JsdomAppOptions {
  readonly localStorage?: Readonly<Record<string, string>>;
  readonly pathname?: string;
  readonly reducedMotion?: boolean;
  readonly fetchResponses?: Readonly<Record<string, {
    readonly status: number;
    readonly body?: string;
    readonly headers?: Readonly<Record<string, string>>;
  }>>;
}

export async function mountJsdomApp(
  search = '?sceneSource=live-sim&appMode=sinr-experiment',
  options: JsdomAppOptions = {},
): Promise<MountedJsdomApp> {
  const pathname = options.pathname ?? '/';
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: `http://localhost${pathname.startsWith('/') ? pathname : `/${pathname}`}${search.startsWith('?') ? search : `?${search}`}`,
    pretendToBeVisual: true,
  });
  exposeWindow(dom.window as unknown as Window & typeof globalThis, options.reducedMotion === true);
  for (const [key, value] of Object.entries(options.localStorage ?? {})) {
    dom.window.localStorage.setItem(key, value);
  }

  const errors: string[] = [];
  const requests: string[] = [];
  const originalFetch = globalThis.fetch;
  const trackedFetch: typeof fetch = async (input, init) => {
    const requestUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
    const pathname = new URL(requestUrl, dom.window.location.href).pathname;
    if (
      pathname.startsWith('/tle-archive/')
      || pathname.startsWith('/homepage-first-frame/')
      || pathname.startsWith('/visual-lab-default-full-run/')
    ) requests.push(pathname);
    const mockResponse = options.fetchResponses?.[pathname];
    if (mockResponse !== undefined) {
      return new Response(mockResponse.body ?? '', {
        status: mockResponse.status,
        headers: mockResponse.headers,
      });
    }
    return originalFetch(input, init);
  };
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: trackedFetch });
  Object.defineProperty(dom.window, 'fetch', { configurable: true, value: trackedFetch });
  const originalConsoleError = console.error;
  const onWindowError = (event: Event): void => {
    const error = event as ErrorEvent;
    if (error.error instanceof Error) errors.push(error.error.stack ?? error.error.message);
    else if (error.message) errors.push(error.message);
  };
  const onUnhandledRejection = (event: Event): void => {
    const reason = (event as PromiseRejectionEvent).reason;
    errors.push(formatConsoleArgument(reason));
  };
  console.error = (...args: unknown[]) => {
    if (!isReactWarning(args)) errors.push(args.map(formatConsoleArgument).join(' '));
  };
  dom.window.addEventListener('error', onWindowError);
  dom.window.addEventListener('unhandledrejection', onUnhandledRejection);

  const { App } = await import('../../src/App.tsx');
  const { createRoot } = await import('react-dom/client');
  const root: Root = createRoot(dom.window.document.getElementById('root') as HTMLElement);
  root.render(React.createElement(App));
  await flushDom();

  return {
    dom,
    page: new JsdomPage(dom.window.document),
    errors,
    requests,
    close: () => {
      root.unmount();
      dom.window.removeEventListener('error', onWindowError);
      dom.window.removeEventListener('unhandledrejection', onUnhandledRejection);
      console.error = originalConsoleError;
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      dom.window.close();
    },
  };
}

export async function waitForDom(
  predicate: () => boolean | Promise<boolean>,
  timeout = 30_000,
  label = 'DOM predicate',
  polling = 25,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await predicate()) return;
    await flushDom(polling);
  }
  throw new Error(`${label} timed out after ${timeout}ms`);
}

export async function flushDom(milliseconds = 0): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, milliseconds));
  await Promise.resolve();
}
