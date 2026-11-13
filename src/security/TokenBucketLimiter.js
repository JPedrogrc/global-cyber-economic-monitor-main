/**
 * Token Bucket Rate Limiter: absorve rajadas até `capacity` e
 * repõe `refillPerSec` tokens por segundo. O relógio é injetável para testes.
 */
export class TokenBucketLimiter {
  constructor(capacity = 80, refillPerSec = 25, now = () => Date.now()) {
    if (capacity <= 0 || refillPerSec < 0) {
      throw new RangeError("capacity deve ser > 0 e refillPerSec >= 0");
    }
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this.now = now;
    this.tokens = capacity;
    this.lastRefill = now();
  }

  refill() {
    const current = this.now();
    const elapsedSec = (current - this.lastRefill) / 1000;
    if (elapsedSec > 0) {
      this.tokens = Math.min(
        this.capacity,
        this.tokens + elapsedSec * this.refillPerSec,
      );
      this.lastRefill = current;
    }
  }

  consume(count = 1) {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }
}
