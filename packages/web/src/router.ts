type Route = { mountFn: () => void; unmountFn: (() => void) | null };

const routes = new Map<string, Route>();
let currentUnmount: (() => void) | null = null;
let currentPath: string | null = null;

export function register(path: string, mountFn: () => void, unmountFn?: () => void): void {
  routes.set(path, { mountFn, unmountFn: unmountFn ?? null });
}

export function navigate(path: string): void {
  location.hash = path;
}

function dispatch(): void {
  const hash = location.hash || '#/';
  const basePath = hash.split('?')[0];
  if (!routes.has(basePath)) {
    navigate('#/');
    return;
  }
  if (currentPath === basePath) return;
  const route = routes.get(basePath)!;
  currentUnmount?.();
  currentUnmount = route.unmountFn;
  currentPath = basePath;
  route.mountFn();
  focusMainContent();
}

window.addEventListener('hashchange', dispatch);

export function start(): void {
  dispatch();
}

function focusMainContent(): void {
  const schedule = window.requestAnimationFrame ??
    ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
  schedule(() => {
    const main = document.querySelector<HTMLElement>('#main-content');
    main?.focus({ preventScroll: true });
  });
}
