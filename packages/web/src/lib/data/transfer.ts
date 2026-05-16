const _registry = new Map<string, File>();

export function storeTransfer(file: File): string {
  const id = Math.random().toString(36).slice(2);
  _registry.set(id, file);
  return id;
}

export function consumeTransfer(id: string): File | null {
  const file = _registry.get(id) ?? null;
  _registry.delete(id);
  return file;
}
