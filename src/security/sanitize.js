import { INVALID_IP } from "../config/constants.js";

const DANGEROUS_CHARS = /[<>"'`;]/g;
const DANGEROUS_PATTERNS =
  /(javascript:|onerror=|onload=|eval\(|union\s+select|drop\s+table)/gi;

// 0-255, aceitando até 3 dígitos com zeros à esquerda (formato do DShield)
const IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|0?[1-9]\\d|0{0,2}\\d)";
const IPV4_REGEX = new RegExp(`^(?:${IPV4_OCTET}\\.){3}${IPV4_OCTET}$`);
// Exige pelo menos dois ":" para não aceitar palavras hexadecimais ("cafe", "abc")
const IPV6_REGEX = /^(?=(?:[^:]*:){2,})[0-9a-fA-F:]{2,39}$/;

/**
 * Sanitização contra XSS, HTML Injection e SQLi em textos vindos de feeds externos.
 * Não é a única defesa: o React já escapa texto e o CSP (netlify.toml) bloqueia scripts.
 */
export function sanitizeString(input, maxLen = 110) {
  if (typeof input !== "string") return "";
  return input
    .replace(DANGEROUS_CHARS, "")
    .replace(DANGEROUS_PATTERNS, "[BLOCKED]")
    .trim()
    .slice(0, maxLen);
}

/**
 * O DShield devolve IPv4 com zeros à esquerda ("045.010.001.002");
 * normalizamos para a forma canônica ("45.10.1.2").
 */
function normalizeIpv4(ip) {
  return ip
    .split(".")
    .map((octet) => String(Number(octet)))
    .join(".");
}

/**
 * Valida endereços IPv4/IPv6 antes da renderização.
 * Retorna INVALID_IP para qualquer valor fora do formato esperado.
 */
export function sanitizeIp(ip) {
  if (typeof ip !== "string") return INVALID_IP;
  const cleaned = ip.trim();
  if (IPV4_REGEX.test(cleaned)) return normalizeIpv4(cleaned);
  if (IPV6_REGEX.test(cleaned)) return cleaned.toLowerCase();
  return INVALID_IP;
}

export function isValidPort(value) {
  return Number.isInteger(value) && value > 0 && value <= 65535;
}
