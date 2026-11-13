// Parâmetros centrais da aplicação (evita "números mágicos" espalhados pelo código)

export const MAX_SERIES_POINTS = 24;
export const MAX_THREAT_LOGS = 25;
export const TOP_IPS_LIMIT = 6;
export const CACHE_KEY = "gcem_osint_swr_cache_v2";

export const ALL = "ALL";

export const OSINT_REFRESH_MS = 30_000;
export const OSINT_TIMEOUT_MS = 7_000;
export const TELEMETRY_TICK_MS = 2_200;

export const RATE_LIMIT = { capacity: 90, refillPerSec: 30 };
export const CIRCUIT_BREAKER = { failureThreshold: 3, resetTimeoutMs: 15_000 };

export const SANS_ENDPOINTS = {
  infocon: "https://isc.sans.edu/api/infocon?json",
  topIps: `https://isc.sans.edu/api/topips/records/${TOP_IPS_LIMIT}?json`,
};

export const INFOCON_LEVELS = ["GREEN", "YELLOW", "ORANGE", "RED"];

export const INVALID_IP = "INVALID_IP_DROPPED";
