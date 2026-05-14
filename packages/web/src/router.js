const routes = new Map();
let currentUnmount = null;
let currentPath = null;

export function register(path, mountFn, unmountFn) {
  routes.set(path, { mountFn, unmountFn: unmountFn ?? null });
}

export function navigate(path) {
  location.hash = path;
}

function dispatch() {
  const hash = location.hash || '#/';
  const basePath = hash.split('?')[0] || '#/';
  if (!routes.has(basePath)) {
    navigate('#/');
    return;
  }
  if (currentPath === basePath) return;
  const route = routes.get(basePath);
  currentUnmount?.();
  currentUnmount = route.unmountFn;
  currentPath = basePath;
  route.mountFn();
}

window.addEventListener('hashchange', dispatch);

export function start() {
  dispatch();
}
