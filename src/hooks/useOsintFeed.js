import { useCallback, useEffect, useRef, useState } from "react";
import { CIRCUIT_BREAKER, OSINT_REFRESH_MS } from "../config/constants.js";
import { CURATED_OSINT_BASELINE } from "../data/demoData.js";
import { ApiCircuitBreaker } from "../security/ApiCircuitBreaker.js";
import {
  describeFeedStatus,
  fetchSansFeeds,
  mergeThreatLogs,
  readCache,
  writeCache,
} from "../services/osintFeed.js";

/**
 * Coleta periódica do SANS ISC protegida por Circuit Breaker,
 * com fallback para cache local e, por último, dados de demonstração.
 */
export function useOsintFeed({
  fetchFeeds = fetchSansFeeds,
  refreshMs = OSINT_REFRESH_MS,
} = {}) {
  const [infoconLevel, setInfoconLevel] = useState("N/D");
  const [threatLogs, setThreatLogs] = useState(CURATED_OSINT_BASELINE);
  const [feedStatus, setFeedStatus] = useState(
    "Aguardando consulta às fontes SANS ISC",
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [circuitState, setCircuitState] = useState("CLOSED");

  const breakerRef = useRef(null);
  breakerRef.current ??= new ApiCircuitBreaker(
    CIRCUIT_BREAKER.failureThreshold,
    CIRCUIT_BREAKER.resetTimeoutMs,
  );
  const isFetchingRef = useRef(false);

  const refresh = useCallback(async () => {
    const breaker = breakerRef.current;
    if (isFetchingRef.current) return;
    if (!breaker.canRequest()) {
      setCircuitState(breaker.state);
      setFeedStatus("SANS ISC temporariamente indisponível (Circuit Breaker)");
      return;
    }

    isFetchingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await fetchFeeds();
      breaker.recordSuccess();
      if (result.infocon) setInfoconLevel(result.infocon);
      if (result.topIps?.length) {
        setThreatLogs((prev) => {
          const merged = mergeThreatLogs(result.topIps, prev);
          writeCache(merged);
          return merged;
        });
      }
      setFeedStatus(describeFeedStatus(result));
    } catch {
      breaker.recordFailure();
      setFeedStatus("SANS ISC indisponível — exibindo último cache/demonstração");
      const cached = readCache();
      if (cached.length > 0) setThreatLogs(cached);
    } finally {
      setCircuitState(breaker.state);
      isFetchingRef.current = false;
      setIsSyncing(false);
    }
  }, [fetchFeeds]);

  useEffect(() => {
    refresh();
    const intervalId = setInterval(refresh, refreshMs);
    return () => clearInterval(intervalId);
  }, [refresh, refreshMs]);

  return { infoconLevel, threatLogs, feedStatus, isSyncing, circuitState, refresh };
}
