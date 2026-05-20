const _registry = new Map<string, File>();

export function storeTransfer(file: File): string {
  // Math.random() è intenzionale: il transfer è in-memory single-tab (fix 0.4.1),
  // non esposto a rete né a contesti multipli — la casualità crittografica non serve.
  const id = Math.random().toString(36).slice(2);
  _registry.set(id, file);
  return id;
}

export function consumeTransfer(id: string): File | null {
  const file = _registry.get(id) ?? null;
  _registry.delete(id);
  return file;
}
