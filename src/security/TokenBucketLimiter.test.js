import { describe, expect, it } from "vitest";
import { TokenBucketLimiter } from "./TokenBucketLimiter.js";

/** Relógio controlável: elimina a dependência do tempo real nos testes. */
function fakeClock(start = 0) {
  let current = start;
  const now = () => current;
  now.advance = (ms) => {
    current += ms;
  };
  return now;
}

describe("TokenBucketLimiter", () => {
  it("começa cheio e aceita exatamente `capacity` requisições em rajada", () => {
    const limiter = new TokenBucketLimiter(5, 1, fakeClock());
    const results = Array.from({ length: 6 }, () => limiter.consume());
    expect(results).toEqual([true, true, true, true, true, false]);
  });

  it("rejeita quando o pedido é maior que os tokens restantes (valor limite)", () => {
    const limiter = new TokenBucketLimiter(10, 1, fakeClock());
    expect(limiter.consume(10)).toBe(true);
    expect(limiter.consume(1)).toBe(false);
  });

  it("não consome tokens quando a requisição é rejeitada", () => {
    const limiter = new TokenBucketLimiter(3, 1, fakeClock());
    expect(limiter.consume(5)).toBe(false);
    expect(limiter.tokens).toBe(3);
  });

  it("repõe tokens proporcionalmente ao tempo decorrido", () => {
    const clock = fakeClock();
    const limiter = new TokenBucketLimiter(10, 2, clock);
    limiter.consume(10);

    clock.advance(1000); // +2 tokens
    expect(limiter.consume(2)).toBe(true);
    expect(limiter.consume(1)).toBe(false);
  });

  it("acumula reposição fracionária entre chamadas", () => {
    const clock = fakeClock();
    const limiter = new TokenBucketLimiter(1, 1, clock);
    limiter.consume();

    clock.advance(500);
    expect(limiter.consume()).toBe(false); // 0.5 token
    clock.advance(500);
    expect(limiter.consume()).toBe(true); // 1.0 token
  });

  it("nunca ultrapassa a capacidade, mesmo após longa inatividade", () => {
    const clock = fakeClock();
    const limiter = new TokenBucketLimiter(5, 100, clock);
    clock.advance(60_000);
    limiter.refill();
    expect(limiter.tokens).toBe(5);
  });

  it("ignora relógio que volta no tempo (não gera tokens negativos)", () => {
    const clock = fakeClock(10_000);
    const limiter = new TokenBucketLimiter(2, 1, clock);
    limiter.consume(2);
    clock.advance(-5_000);
    expect(limiter.consume()).toBe(false);
    expect(limiter.tokens).toBe(0);
  });

  it("sob flood (1000 req instantâneas) aceita só a capacidade configurada", () => {
    const limiter = new TokenBucketLimiter(90, 30, fakeClock());
    const accepted = Array.from({ length: 1000 }, () => limiter.consume()).filter(Boolean);
    expect(accepted).toHaveLength(90);
  });

  it.each([
    [0, 1],
    [-1, 1],
    [10, -1],
  ])("rejeita configuração inválida (capacity=%i, refill=%i)", (capacity, refill) => {
    expect(() => new TokenBucketLimiter(capacity, refill)).toThrow(RangeError);
  });
});
