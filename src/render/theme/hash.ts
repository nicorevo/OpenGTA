/**
 * FNV-1a 32-bit: a simple, dependency-free, deterministic string hash.
 * Used for persistent visual styling (building variants), where the same
 * input must always yield the same variant — no Math.random() anywhere.
 */
export function stableStringHash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
