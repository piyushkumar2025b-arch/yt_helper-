/**
 * Production-safe in-memory rate limiter with LRU / expired-prune eviction.
 * Resolves BUG-003 (in-memory rate limiter wiping all clients) and
 * BUG-014 (hardcoded rate limit constants).
 */

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  maxLlmRequests?: number;
  maxEntries?: number;
}

export interface ClientRateEntry {
  count: number;
  llmCount: number;
  resetAt: number;
}

export class MemoryRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxLlmRequests: number;
  private readonly maxEntries: number;
  private readonly map = new Map<string, ClientRateEntry>();

  constructor(options: RateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? (Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000);
    this.maxRequests = options.maxRequests ?? (Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 120);
    this.maxLlmRequests = options.maxLlmRequests ?? (Number(process.env.LLM_RATE_LIMIT_MAX_REQUESTS) || 25);
    this.maxEntries = options.maxEntries ?? (Number(process.env.RATE_LIMIT_MAX_ENTRIES) || 2000);
  }

  public check(
    ip: string,
    isLlmRoute = false,
    now: number = Date.now()
  ): { allowed: boolean; remaining: number; resetInMs: number } {
    let entry = this.map.get(ip);

    if (!entry || now > entry.resetAt) {
      this.pruneIfNeeded(now);
      entry = {
        count: 0,
        llmCount: 0,
        resetAt: now + this.windowMs,
      };
      this.map.set(ip, entry);
    }

    entry.count++;
    if (isLlmRoute) {
      entry.llmCount++;
    }

    const resetInMs = Math.max(0, entry.resetAt - now);
    const limitReached =
      entry.count > this.maxRequests ||
      (isLlmRoute && entry.llmCount > this.maxLlmRequests);

    const remaining = isLlmRoute
      ? Math.max(0, this.maxLlmRequests - entry.llmCount)
      : Math.max(0, this.maxRequests - entry.count);

    return {
      allowed: !limitReached,
      remaining,
      resetInMs,
    };
  }

  private pruneIfNeeded(now: number): void {
    if (this.map.size < this.maxEntries) return;

    // Phase 1: Prune expired entries without touching active clients
    for (const [key, value] of this.map.entries()) {
      if (now > value.resetAt) {
        this.map.delete(key);
      }
    }

    // Phase 2: If still above capacity, evict oldest entries (FIFO order)
    if (this.map.size >= this.maxEntries) {
      const excess = this.map.size - Math.floor(this.maxEntries * 0.75);
      let count = 0;
      for (const key of this.map.keys()) {
        this.map.delete(key);
        count++;
        if (count >= excess) break;
      }
    }
  }

  public get size(): number {
    return this.map.size;
  }

  public clear(): void {
    this.map.clear();
  }
}

export const defaultRateLimiter = new MemoryRateLimiter();
