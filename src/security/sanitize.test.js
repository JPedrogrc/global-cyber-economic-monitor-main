import { describe, expect, it } from "vitest";
import { INVALID_IP } from "../config/constants.js";
import { isValidPort, sanitizeIp, sanitizeString } from "./sanitize.js";

describe("sanitizeString (anti-XSS / injeção)", () => {
  it.each([
    ["<script>alert(1)</script>", "scriptalert(1)/script"],
    ['<img src=x onerror="alert(1)">', "img src=x [BLOCKED]alert(1)"],
    ["javascript:alert(document.cookie)", "[BLOCKED]alert(document.cookie)"],
    ["<svg onload=alert(1)>", "svg [BLOCKED]alert(1)"],
    ["eval(atob('x'))", "[BLOCKED]atob(x))"],
    ["1 UNION SELECT password FROM users", "1 [BLOCKED] password FROM users"],
    ["x'; DROP TABLE users;--", "x [BLOCKED] users--"],
  ])("neutraliza payload %s", (payload, expected) => {
    const result = sanitizeString(payload);
    expect(result).toBe(expected);
    expect(result).not.toMatch(/[<>"'`;]/);
  });

  it("é case-insensitive para padrões perigosos", () => {
    expect(sanitizeString("JaVaScRiPt:x")).toBe("[BLOCKED]x");
  });

  it("preserva texto legítimo com acentos", () => {
    expect(sanitizeString("  São Paulo — Bolsa  ")).toBe("São Paulo — Bolsa");
  });

  it("limita o tamanho (proteção contra payloads gigantes)", () => {
    expect(sanitizeString("a".repeat(10_000))).toHaveLength(110);
    expect(sanitizeString("abcdef", 3)).toBe("abc");
  });

  it.each([null, undefined, 42, {}, [], true])("retorna string vazia para %p", (value) => {
    expect(sanitizeString(value)).toBe("");
  });
});

describe("sanitizeIp", () => {
  it.each([
    ["8.8.8.8", "8.8.8.8"],
    ["0.0.0.0", "0.0.0.0"],
    ["255.255.255.255", "255.255.255.255"],
    ["  1.2.3.4  ", "1.2.3.4"],
    ["045.148.010.240", "45.148.10.240"], // formato zero-padded do DShield
    ["2001:db8::1", "2001:db8::1"],
    ["::1", "::1"],
    ["FE80::ABCD", "fe80::abcd"],
  ])("aceita %s", (input, expected) => {
    expect(sanitizeIp(input)).toBe(expected);
  });

  it.each([
    "256.1.1.1",
    "1.2.3",
    "1.2.3.4.5",
    "1.2.3.-1",
    "0099.1.1.1",
    "cafe", // hexadecimal sem ":" não é IPv6
    "abc",
    "1.2.3.4<script>",
    "<img src=x>",
    "",
    "localhost",
  ])("rejeita %s", (input) => {
    expect(sanitizeIp(input)).toBe(INVALID_IP);
  });

  it.each([null, undefined, 123, {}])("rejeita tipo não-string %p", (value) => {
    expect(sanitizeIp(value)).toBe(INVALID_IP);
  });
});

describe("isValidPort", () => {
  it.each([
    [1, true],
    [443, true],
    [65535, true],
    [0, false],
    [65536, false],
    [-1, false],
    [80.5, false],
    [Number.NaN, false],
  ])("porta %p -> %p", (port, expected) => {
    expect(isValidPort(port)).toBe(expected);
  });
});
