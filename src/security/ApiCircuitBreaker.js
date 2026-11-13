export const CIRCUIT_STATE = Object.freeze({
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF-OPEN",
});

/**
 * Circuit Breaker para isolar falhas de APIs externas OSINT.
 * CLOSED -> (N falhas) -> OPEN -> (timeout) -> HALF-OPEN -> sucesso: CLOSED / falha: OPEN
 */
export class ApiCircuitBreaker {
  constructor(failureThreshold = 3, resetTimeoutMs = 15000, now = () => Date.now()) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.now = now;
    this.state = CIRCUIT_STATE.CLOSED;
    this.failures = 0;
    this.nextAttempt = 0;
  }

  canRequest() {
    if (this.state === CIRCUIT_STATE.CLOSED) return true;
    if (this.state === CIRCUIT_STATE.OPEN && this.now() >= this.nextAttempt) {
      this.state = CIRCUIT_STATE.HALF_OPEN;
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.failures = 0;
    this.state = CIRCUIT_STATE.CLOSED;
  }

  recordFailure() {
    this.failures += 1;
    const halfOpenProbeFailed = this.state === CIRCUIT_STATE.HALF_OPEN;
    if (halfOpenProbeFailed || this.failures >= this.failureThreshold) {
      this.state = CIRCUIT_STATE.OPEN;
      this.nextAttempt = this.now() + this.resetTimeoutMs;
    }
  }
}
