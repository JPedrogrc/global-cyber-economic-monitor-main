import { useEffect, useRef, useState } from "react";
import { RATE_LIMIT, TELEMETRY_TICK_MS } from "../config/constants.js";
import { INITIAL_TIME_SERIES } from "../data/demoData.js";
import { appendTimeSeriesPoint, simulateTrafficCycle } from "../domain/telemetry.js";
import { TokenBucketLimiter } from "../security/TokenBucketLimiter.js";

const INITIAL_METRICS = {
  requestsAccepted: 0,
  requestsDropped: 0,
  xssBlocked: 0,
  currentRps: 0,
};

/**
 * Telemetria simulada no navegador. Pausa quando a aba está oculta
 * para não gastar CPU/bateria (melhoria de performance).
 */
export function useTelemetryStream(ddosSimulation, tickMs = TELEMETRY_TICK_MS) {
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [timeSeries, setTimeSeries] = useState(INITIAL_TIME_SERIES);
  const limiterRef = useRef(null);
  limiterRef.current ??= new TokenBucketLimiter(
    RATE_LIMIT.capacity,
    RATE_LIMIT.refillPerSec,
  );

  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      const cycle = simulateTrafficCycle(limiterRef.current, ddosSimulation);
      setMetrics((prev) => ({
        requestsAccepted: prev.requestsAccepted + cycle.accepted,
        requestsDropped: prev.requestsDropped + cycle.dropped,
        xssBlocked: prev.xssBlocked + cycle.xssBlocked,
        currentRps: cycle.incoming,
      }));
      const label = new Date().toTimeString().slice(0, 8);
      setTimeSeries((prev) =>
        appendTimeSeriesPoint(prev, { ddosSimulation, label }),
      );
    };
    const intervalId = setInterval(tick, tickMs);
    return () => clearInterval(intervalId);
  }, [ddosSimulation, tickMs]);

  return { metrics, timeSeries };
}
