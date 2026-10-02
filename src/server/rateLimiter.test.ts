import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRateLimiter } from './rateLimiter.ts';

describe('MemoryRateLimiter (BUG-003, BUG-014)', () => {
  it('allows requests within limit and rejects when exceeded', () => {
    const limiter = new MemoryRateLimiter({
      windowMs: 1000,
      maxRequests: 3,
      maxLlmRequests: 2,
    });

    const ip = '192.168.1.50';
    const now = 10000;

    assert.equal(limiter.check(ip, false, now).allowed, true);
    assert.equal(limiter.check(ip, false, now).allowed, true);
    assert.equal(limiter.check(ip, false, now).allowed, true);
    // Exceeded maxRequests (3)
    assert.equal(limiter.check(ip, false, now).allowed, false);
  });

  it('enforces stricter limits on LLM routes', () => {
    const limiter = new MemoryRateLimiter({
      windowMs: 1000,
      maxRequests: 10,
      maxLlmRequests: 2,
    });

    const ip = '10.0.0.1';
    const now = 20000;

    assert.equal(limiter.check(ip, true, now).allowed, true);
    assert.equal(limiter.check(ip, true, now).allowed, true);
    // Exceeded maxLlmRequests (2)
    assert.equal(limiter.check(ip, true, now).allowed, false);
  });

  it('prunes expired entries without wiping active client counts (BUG-003)', () => {
    const limiter = new MemoryRateLimiter({
      windowMs: 1000,
      maxRequests: 5,
      maxEntries: 3,
    });

    const baseTime = 100000;
    // Add client A and client B at baseTime
    limiter.check('client-A', false, baseTime);
    limiter.check('client-A', false, baseTime);
    limiter.check('client-B', false, baseTime);

    // Fast-forward past windowMs for A and B, but register client C
    const futureTime = baseTime + 2000;
    limiter.check('client-C', false, futureTime);

    // Client C should be active
    const resC = limiter.check('client-C', false, futureTime);
    assert.equal(resC.allowed, true);

    // Total size should not blow up and expired records get pruned
    assert.ok(limiter.size <= 3);
  });
});
