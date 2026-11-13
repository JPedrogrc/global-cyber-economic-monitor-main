import {
  CACHE_KEY,
  INFOCON_LEVELS,
  INVALID_IP,
  MAX_THREAT_LOGS,
  OSINT_TIMEOUT_MS,
  SANS_ENDPOINTS,
  TOP_IPS_LIMIT,
} from "../config/constants.js";
import { isValidPort, sanitizeIp, sanitizeString } from "../security/sanitize.js";

export async function fetchJsonWithTimeout(
  url,
  timeoutMs = OSINT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao consultar ${url}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Retorna o nível Infocon válido ou null se o payload for inesperado. */
export function parseInfocon(payload) {
  const status = sanitizeString(payload?.status ?? "", 15).toUpperCase();
  return INFOCON_LEVELS.includes(status) ? status : null;
}

function extractIpList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.topips)) return payload.topips;
  return null;
}

function toThreatLog(item, idx, collectedAt) {
  const ip = sanitizeIp(item?.source || item?.ip || "");
  if (ip === INVALID_IP) return null;

  const eventCount = Number(item?.count ?? item?.attacks);
  const targetPort = Number(item?.targetport);
  const hasCount = Number.isFinite(eventCount) && eventCount >= 0;

  return {
    id: `sans-${collectedAt}-${idx}`,
    agency: "SANS ISC / DShield",
    ip,
    port: isValidPort(targetPort) ? targetPort : "N/D",
    threatType: hasCount
      ? `IP observado no Top Attackers (${eventCount} eventos)`
      : "IP observado no Top Attackers",
    targetSector: "NÃO CLASSIFICADO",
    severity: "NÃO CLASSIFICADA",
    status: "OBSERVADO",
    collectedAt,
    isDemo: false,
  };
}

/**
 * Converte o payload do Top IPs em registros sanitizados.
 * Retorna null quando o formato é inválido (conta como falha do endpoint).
 */
export function parseTopIps(payload, collectedAt = new Date().toISOString()) {
  const list = extractIpList(payload);
  if (!list) return null;
  return list
    .slice(0, TOP_IPS_LIMIT)
    .map((item, idx) => toThreatLog(item, idx, collectedAt))
    .filter(Boolean);
}

/** Junta registros novos com os reais anteriores, sem duplicar IPs e descartando demos. */
export function mergeThreatLogs(incoming, previous) {
  const seen = new Set();
  return [...incoming, ...previous.filter((item) => !item.isDemo)]
    .filter((item) => {
      if (seen.has(item.ip)) return false;
      seen.add(item.ip);
      return true;
    })
    .slice(0, MAX_THREAT_LOGS);
}

export function writeCache(logs, storage = globalThis.localStorage) {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(logs));
  } catch {
    // Cache é opcional; a aplicação continua mesmo sem localStorage.
  }
}

/**
 * Lê o cache e revalida cada registro: o localStorage pode ter sido adulterado.
 */
export function readCache(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(CACHE_KEY) ?? "null");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && sanitizeIp(item.ip) !== INVALID_IP)
      .slice(0, MAX_THREAT_LOGS)
      .map((item, idx) => ({
        id: sanitizeString(String(item.id ?? `cache-${idx}`), 60),
        agency: sanitizeString(item.agency, 40),
        ip: sanitizeIp(item.ip),
        port: isValidPort(item.port) ? item.port : "N/D",
        threatType: sanitizeString(item.threatType),
        targetSector: sanitizeString(item.targetSector, 40),
        severity: sanitizeString(item.severity, 30),
        status: sanitizeString(item.status, 20),
        collectedAt: sanitizeString(item.collectedAt, 40),
        isDemo: false,
      }));
  } catch {
    return [];
  }
}

/**
 * Consulta os dois endpoints do SANS ISC de forma isolada (Promise.allSettled).
 * Sucesso parcial é sucesso; só falha quando nenhum endpoint traz dados válidos.
 */
export async function fetchSansFeeds(fetchJson = fetchJsonWithTimeout) {
  const [infoconResult, topIpsResult] = await Promise.allSettled([
    fetchJson(SANS_ENDPOINTS.infocon),
    fetchJson(SANS_ENDPOINTS.topIps),
  ]);

  const infocon =
    infoconResult.status === "fulfilled" ? parseInfocon(infoconResult.value) : null;
  const topIps =
    topIpsResult.status === "fulfilled" ? parseTopIps(topIpsResult.value) : null;

  if (infocon === null && topIps === null) {
    throw new Error("Nenhum endpoint do SANS ISC retornou dados válidos.");
  }
  return { infocon, topIps };
}

export function describeFeedStatus({ infocon, topIps }) {
  const label = (ok) => (ok ? "OK" : "indisponível");
  return `SANS ISC — Infocon: ${label(infocon !== null)} | Top IPs: ${label(topIps !== null)}`;
}
