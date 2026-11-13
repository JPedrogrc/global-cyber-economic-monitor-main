import { describe, expect, it } from "vitest";
import { ApiCircuitBreaker, CIRCUIT_STATE } from "./ApiCircuitBreaker.js";

function fakeClock() {
  let current = 0;
  const now = () => current;
  now.advance = (ms) => {
    current += ms;
  };
  return now;
}

function failTimes(breaker, n) {
  for (let i = 0; i < n; i++) breaker.recordFailure();
}

// Teste baseado em transição de estados: CLOSED -> OPEN -> HALF-OPEN -> CLOSED/OPEN
describe("ApiCircuitBreaker", () => {
  it("inicia CLOSED e permite requisições", () => {
    const breaker = new ApiCircuitBreaker(3, 1000, fakeClock());
    expect(breaker.state).toBe(CIRCUIT_STATE.CLOSED);
    expect(breaker.canRequest()).toBe(true);
  });

  it("continua CLOSED com falhas abaixo do limite (limite - 1)", () => {
    const breaker = new ApiCircuitBreaker(3, 1000, fakeClock());
    failTimes(breaker, 2);
    expect(breaker.state).toBe(CIRCUIT_STATE.CLOSED);
    expect(breaker.canRequest()).toBe(true);
  });

  it("abre (OPEN) ao atingir exatamente o limite de falhas e bloqueia chamadas", () => {
    const breaker = new ApiCircuitBreaker(3, 1000, fakeClock());
    failTimes(breaker, 3);
    expect(breaker.state).toBe(CIRCUIT_STATE.OPEN);
    expect(breaker.canRequest()).toBe(false);
  });

  it("permanece OPEN 1ms antes do timeout de reset", () => {
    const clock = fakeClock();
    const breaker = new ApiCircuitBreaker(3, 1000, clock);
    failTimes(breaker, 3);
    clock.advance(999);
    expect(breaker.canRequest()).toBe(false);
    expect(breaker.state).toBe(CIRCUIT_STATE.OPEN);
  });

  it("vai para HALF-OPEN após o timeout e libera uma tentativa", () => {
    const clock = fakeClock();
    const breaker = new ApiCircuitBreaker(3, 1000, clock);
    failTimes(breaker, 3);
    clock.advance(1000);
    expect(breaker.canRequest()).toBe(true);
    expect(breaker.state).toBe(CIRCUIT_STATE.HALF_OPEN);
  });

  it("em HALF-OPEN libera somente uma sonda por vez", () => {
    const clock = fakeClock();
    const breaker = new ApiCircuitBreaker(3, 1000, clock);
    failTimes(breaker, 3);
    clock.advance(1000);
    breaker.canRequest();
    expect(breaker.canRequest()).toBe(false);
  });

  it("HALF-OPEN + sucesso fecha o circuito e zera falhas", () => {
    const clock = fakeClock();
    const breaker = new ApiCircuitBreaker(3, 1000, clock);
    failTimes(breaker, 3);
    clock.advance(1000);
    breaker.canRequest();
    breaker.recordSuccess();
    expect(breaker.state).toBe(CIRCUIT_STATE.CLOSED);
    expect(breaker.failures).toBe(0);
  });

  it("HALF-OPEN + falha reabre o circuito e reinicia o timeout", () => {
    const clock = fakeClock();
    const breaker = new ApiCircuitBreaker(3, 1000, clock);
    failTimes(breaker, 3);
    clock.advance(1000);
    breaker.canRequest();
    breaker.recordFailure();
    expect(breaker.state).toBe(CIRCUIT_STATE.OPEN);
    clock.advance(500);
    expect(breaker.canRequest()).toBe(false);
  });

  it("sucesso intermediário zera a contagem (falhas não são cumulativas)", () => {
    const breaker = new ApiCircuitBreaker(3, 1000, fakeClock());
    failTimes(breaker, 2);
    breaker.recordSuccess();
    failTimes(breaker, 2);
    expect(breaker.state).toBe(CIRCUIT_STATE.CLOSED);
  });
});
