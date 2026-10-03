import { createHash } from 'node:crypto';

/**
 * Creates a deterministic SHA-256 cryptographic digest of any JSON-serializable value.
 */
export function sha256Digest(value: unknown): string {
  const json = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('sha256').update(json).digest('hex');
}

/**
 * Bounded Map cache with LRU-like eviction on insertion.
 */
export class BoundedCache<K, V> {
  private map = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    return this.map.get(key);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): void {
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, value);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
