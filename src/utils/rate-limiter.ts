const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_JITTER_MS = 500;
const MAX_RETRY_AFTER_MS = 60_000;

const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  images: { maxRequests: 10, windowMs: 60_000 },
  nodes: { maxRequests: 30, windowMs: 60_000 },
};

function jitter(): number {
  return Math.floor(Math.random() * MAX_JITTER_MS);
}

function backoffDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt) + jitter();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface QueueEntry {
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

export class RateLimiter {
  private queues: Record<string, QueueEntry[]> = {};
  private running: Record<string, boolean> = {};
  private requestTimestamps: Record<string, number[]> = {};

  async withRetry<T>(fn: () => Promise<T>, retries: number = MAX_RETRIES): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;

        const isRateLimit =
          typeof err === "object" &&
          err !== null &&
          "status" in err &&
          (err as { status: number }).status === 429;

        if (!isRateLimit) {
          throw err;
        }

        if (attempt === retries) {
          break;
        }

        let waitMs = backoffDelay(attempt);

        if (typeof err === "object" && err !== null && "headers" in err) {
          const headers = (err as { headers?: Record<string, string> }).headers;
          const retryAfter = headers?.["retry-after"] ?? headers?.["Retry-After"];
          if (retryAfter !== undefined) {
            const retryAfterMs = Number(retryAfter) * 1000;
            if (!Number.isNaN(retryAfterMs)) {
              waitMs = Math.min(retryAfterMs, MAX_RETRY_AFTER_MS);
            }
          }
        }

        await sleep(waitMs);
      }
    }

    throw new Error("Figma API rate limit exceeded after 3 retries. Try again later.");
  }

  async throttle<T>(apiType: string, fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.queues[apiType]) {
        this.queues[apiType] = [];
        this.requestTimestamps[apiType] = [];
      }

      this.queues[apiType].push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      void this.processQueue(apiType);
    });
  }

  private async processQueue(apiType: string): Promise<void> {
    if (this.running[apiType]) return;
    this.running[apiType] = true;

    const limit = RATE_LIMITS[apiType] ?? { maxRequests: 30, windowMs: 60_000 };

    while (this.queues[apiType].length > 0) {
      const now = Date.now();

      this.requestTimestamps[apiType] = this.requestTimestamps[apiType].filter(
        (ts) => now - ts < limit.windowMs,
      );

      if (this.requestTimestamps[apiType].length >= limit.maxRequests) {
        const oldest = this.requestTimestamps[apiType][0];
        const waitMs = limit.windowMs - (now - oldest) + 1;
        await sleep(waitMs);
        continue;
      }

      const entry = this.queues[apiType].shift();
      if (!entry) break;

      this.requestTimestamps[apiType].push(Date.now());

      try {
        const result = await entry.fn();
        entry.resolve(result);
      } catch (err) {
        entry.reject(err);
      }
    }

    this.running[apiType] = false;
  }
}
