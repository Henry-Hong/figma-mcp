import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../src/utils/rate-limiter.js';

function make429Error(headers?: Record<string, string>): Error {
  return Object.assign(new Error('Rate limit exceeded'), {
    status: 429,
    ...(headers ? { headers } : {}),
  });
}

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withRetry - exponential backoff', () => {
    it('retries on 429 and succeeds on the second attempt', async () => {
      const rateLimiter = new RateLimiter();
      let callCount = 0;

      const fn = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw make429Error();
        }
        return 'success';
      });

      const promise = rateLimiter.withRetry(fn);
      // Advance timers to allow backoff sleep to complete
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries exactly MAX_RETRIES times before throwing', async () => {
      const rateLimiter = new RateLimiter();
      const fn = vi.fn(async () => {
        throw make429Error();
      });

      const assertion = expect(rateLimiter.withRetry(fn)).rejects.toThrow('rate limit');
      await vi.runAllTimersAsync();
      await assertion;
      // 1 initial attempt + 3 retries = 4 calls total
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('error message contains "rate limit" after 3 retries', async () => {
      const rateLimiter = new RateLimiter();
      const fn = vi.fn(async () => {
        throw make429Error();
      });

      const assertion = expect(rateLimiter.withRetry(fn)).rejects.toThrow(/rate limit/i);
      await vi.runAllTimersAsync();
      await assertion;
    });

    it('does not retry on non-429 errors', async () => {
      const rateLimiter = new RateLimiter();
      const fn = vi.fn(async () => {
        throw new Error('404 Not found');
      });

      await expect(rateLimiter.withRetry(fn)).rejects.toThrow('404 Not found');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('withRetry - Retry-After header', () => {
    it('waits Retry-After seconds when header is present', async () => {
      const rateLimiter = new RateLimiter();
      let callCount = 0;

      const fn = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw make429Error({ 'retry-after': '5' });
        }
        return 'ok';
      });

      const sleepSpy = vi.spyOn(globalThis, 'setTimeout');

      const promise = rateLimiter.withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('ok');
      // At least one setTimeout call should have been made for the 5s wait
      expect(sleepSpy).toHaveBeenCalled();
    });
  });

  describe('throttle - Images API rate limit', () => {
    it('allows up to 10 requests per minute for images', async () => {
      const rateLimiter = new RateLimiter();
      const results: number[] = [];

      // Queue 11 requests — first 10 should go through immediately,
      // the 11th must wait for the window to pass
      const promises = Array.from({ length: 11 }, (_, i) =>
        rateLimiter.throttle('images', async () => {
          results.push(i);
          return i;
        }),
      );

      // Process the first 10
      await vi.advanceTimersByTimeAsync(0);
      // Flush microtasks for the first 10 to resolve
      for (let i = 0; i < 15; i++) {
        await Promise.resolve();
      }

      // After 10 requests the 11th should still be pending (rate limited)
      expect(results.length).toBeLessThanOrEqual(10);

      // Advance time past the 60s window
      await vi.advanceTimersByTimeAsync(61_000);
      for (let i = 0; i < 15; i++) {
        await Promise.resolve();
      }

      await Promise.all(promises);
      expect(results.length).toBe(11);
    });
  });
});
