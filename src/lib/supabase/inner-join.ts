export function unwrapJoin<T>(raw: unknown): T | undefined {
  return Array.isArray(raw) ? (raw[0] as T) : (raw as T);
}
