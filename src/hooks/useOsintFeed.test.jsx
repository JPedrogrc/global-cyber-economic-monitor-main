import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CIRCUIT_BREAKER } from "../config/constants.js";
import { CURATED_OSINT_BASELINE } from "../data/demoData.js";
import { writeCache } from "../services/osintFeed.js";
import { useOsintFeed } from "./useOsintFeed.js";

const NEVER = 1e9; // desliga o polling automático; os testes chamam refresh()

const realLog = {
  id: "sans-1",
  agency: "SANS ISC / DShield",
  ip: "1.1.1.1",
  port: 22,
  threatType: "IP observado no Top Attackers",
  targetSector: "NÃO CLASSIFICADO",
  severity: "NÃO CLASSIFICADA",
  status: "OBSERVADO",
  collectedAt: "t",
  isDemo: false,
};

async function renderFeed(fetchFeeds) {
  const hook = renderHook(() => useOsintFeed({ fetchFeeds, refreshMs: NEVER }));
  await waitFor(() => expect(hook.result.current.isSyncing).toBe(false));
  return hook;
}

describe("useOsintFeed", () => {
  afterEach(() => vi.useRealTimers());

  it("sucesso: atualiza Infocon, troca demo por dados reais e grava cache", async () => {
    const fetchFeeds = vi.fn().mockResolvedValue({ infocon: "GREEN", topIps: [realLog] });
    const { result } = await renderFeed(fetchFeeds);

    expect(result.current.infoconLevel).toBe("GREEN");
    expect(result.current.threatLogs).toEqual([realLog]);
    expect(result.current.circuitState).toBe("CLOSED");
    expect(JSON.parse(localStorage.getItem("gcem_osint_swr_cache_v2"))).toHaveLength(1);
  });

  it("falha sem cache: mantém dados de demonstração identificados", async () => {
    const fetchFeeds = vi.fn().mockRejectedValue(new Error("CORS"));
    const { result } = await renderFeed(fetchFeeds);

    expect(result.current.threatLogs).toEqual(CURATED_OSINT_BASELINE);
    expect(result.current.threatLogs.every((l) => l.isDemo)).toBe(true);
    expect(result.current.feedStatus).toMatch(/indisponível/);
    expect(result.current.infoconLevel).toBe("N/D");
  });

  it("falha com cache: exibe o último dado real salvo", async () => {
    writeCache([realLog]);
    const fetchFeeds = vi.fn().mockRejectedValue(new Error("offline"));
    const { result } = await renderFeed(fetchFeeds);

    expect(result.current.threatLogs).toEqual([realLog]);
  });

  it(`abre o Circuit Breaker após ${CIRCUIT_BREAKER.failureThreshold} falhas e para de chamar a API`, async () => {
    const fetchFeeds = vi.fn().mockRejectedValue(new Error("down"));
    const { result } = await renderFeed(fetchFeeds); // falha 1

    await act(() => result.current.refresh()); // falha 2
    await act(() => result.current.refresh()); // falha 3 -> OPEN
    expect(result.current.circuitState).toBe("OPEN");

    await act(() => result.current.refresh()); // bloqueada pelo breaker
    expect(fetchFeeds).toHaveBeenCalledTimes(3);
    expect(result.current.feedStatus).toMatch(/Circuit Breaker/);
  });

  it("recupera após o timeout do breaker (HALF-OPEN -> CLOSED)", async () => {
    const fetchFeeds = vi.fn().mockRejectedValue(new Error("down"));
    const { result } = await renderFeed(fetchFeeds);
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());
    expect(result.current.circuitState).toBe("OPEN");

    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + CIRCUIT_BREAKER.resetTimeoutMs);
    fetchFeeds.mockResolvedValue({ infocon: "YELLOW", topIps: null });

    await act(() => result.current.refresh());
    expect(result.current.circuitState).toBe("CLOSED");
    expect(result.current.infoconLevel).toBe("YELLOW");
  });

  it("não dispara chamadas sobrepostas enquanto uma está em andamento", async () => {
    let resolve;
    const fetchFeeds = vi.fn(() => new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useOsintFeed({ fetchFeeds, refreshMs: NEVER }));

    await act(async () => {
      result.current.refresh();
      result.current.refresh();
    });
    expect(fetchFeeds).toHaveBeenCalledTimes(1);

    await act(async () => resolve({ infocon: "GREEN", topIps: null }));
  });

  it("consulta periodicamente e limpa o intervalo ao desmontar", async () => {
    vi.useFakeTimers();
    const fetchFeeds = vi.fn().mockResolvedValue({ infocon: "GREEN", topIps: null });
    const { unmount } = renderHook(() => useOsintFeed({ fetchFeeds, refreshMs: 1000 }));

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(fetchFeeds).toHaveBeenCalledTimes(4); // inicial + 3 ciclos

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(fetchFeeds).toHaveBeenCalledTimes(4);
  });
});
