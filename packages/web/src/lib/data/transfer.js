const _registry = new Map();

export function storeTransfer(file) {
  const id = Math.random().toString(36).slice(2);
  _registry.set(id, file);
  return id;
}

export function consumeTransfer(id) {
  const file = _registry.get(id) ?? null;
  _registry.delete(id);
  return file;
}
