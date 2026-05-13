const routes = new Map();
let currentUnmount = null;

export function register(path, mountFn, unmountFn) {
  routes.set(path, { mountFn, unmountFn: unmountFn ?? null });
}

export function navigate(path) {
  location.hash = path;
}

function dispatch() {
  const hash = location.hash || '#/';
  const route = routes.get(hash) ?? routes.get('#/');
  if (!route) return;
  currentUnmount?.();
  currentUnmount = route.unmountFn;
  route.mountFn();
}

window.addEventListener('hashchange', dispatch);

export function start() {
  dispatch();
}
