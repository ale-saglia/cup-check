declare module 'js-yaml' {
  export function load(source: string): any;
}

declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string);
    window: any;
  }
}

declare module '../src/sw.js' {
  export function buildDatasetCacheName(): string;
  export function buildAppCacheName(): string;
  export function activateCaches(): Promise<void>;
  export function installAppShell(): Promise<void>;
  export function handleFetch(event: FetchEvent): Promise<Response | undefined>;
}

interface Element {
  checked: boolean;
  click(): void;
  disabled: boolean;
  focus(options?: FocusOptions): void;
  value: string;
}
