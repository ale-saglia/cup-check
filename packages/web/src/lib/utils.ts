export function incrementMapValue<K>(map: Map<K, number>, key: K, increment = 1): void {
  map.set(key, (map.get(key) ?? 0) + increment);
}
