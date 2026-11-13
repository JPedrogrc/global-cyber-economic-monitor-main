import { afterEach, describe, expect, it, vi } from "vitest";
import { CACHE_KEY, MAX_THREAT_LOGS, SANS_ENDPOINTS } from "../config/constants.js";
import {
  describeFeedStatus,
  fetchJsonWithTimeout,
  fetchSansFeeds,
  mergeThreatLogs,
  parseInfocon,
  parseTopIps,
  readCache,
  writeCache,
} from "./osintFeed.js";

const jsonResponse = (body, init = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  json: async () => body,
});

describe("parseInfocon", () => {
  it.each(["green", "YELLOW", "Orange", "red"])("aceita nível %s", (status) => {
    expect(parseInfocon({ status })).toBe(status.toUpperCase());
  });

  it.each([
    [{ status: "PURPLE" }],
    [{ status: "<script>RED</script>" }],
    [{}],
    [null],
    ["GREEN"],
    [{ status: 1 }],
  ])("rejeita payload inesperado %p", (payload) => {
    expect(parseInfocon(payload)).toBeNull();
  });
});

describe("parseTopIps", () => {
  const sample = [
    { source: "045.148.010.240", count: 120, targetport: 22 },
    { ip: "8.8.8.8", attacks: 5 },
  ];

  it.each([
    ["array direto", sample],
    ["objeto { data }", { data: sample }],
    ["objeto { topips }", { topips: sample }],
  ])("entende formato %s", (_, payload) => {
    const logs = parseTopIps(payload, "2026-11-12T00:00:00Z");
    expect(logs.map((l) => l.ip)).toEqual(["45.148.10.240", "8.8.8.8"]);
    expect(logs[0]).toMatchObject({
      port: 22,
      threatType: "IP observado no Top Attackers (120 eventos)",
      status: "OBSERVADO",
      isDemo: false,
    });
    expect(logs[1].port).toBe("N/D");
  });

  it.each([null, undefined, {}, "texto", { data: "x" }, 42])(
    "retorna null para formato inválido %p (conta como falha)",
    (payload) => {
      expect(parseTopIps(payload)).toBeNull();
    },
  );

  it("descarta IPs maliciosos ou inválidos sem derrubar o lote", () => {
    const logs = parseTopIps([
      { source: "<img src=x onerror=alert(1)>" },
      { source: "999.1.1.1" },
      { source: null },
      { source: "1.1.1.1", targetport: 70000, count: -3 },
    ]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      ip: "1.1.1.1",
      port: "N/D",
      threatType: "IP observado no Top Attackers",
    });
  });

  it("limita a quantidade de registros processados", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ source: `10.0.0.${i + 1}` }));
    expect(parseTopIps(many)).toHaveLength(6);
  });

  it("lista vazia é resposta válida (não é falha)", () => {
    expect(parseTopIps([])).toEqual([]);
  });
});

describe("mergeThreatLogs", () => {
  it("prioriza novos, remove duplicados e descarta demonstração", () => {
    const merged = mergeThreatLogs(
      [{ ip: "1.1.1.1", id: "new" }],
      [
        { ip: "1.1.1.1", id: "old", isDemo: false },
        { ip: "2.2.2.2", id: "keep", isDemo: false },
        { ip: "192.0.2.10", id: "demo", isDemo: true },
      ],
    );
    expect(merged.map((l) => l.id)).toEqual(["new", "keep"]);
  });

  it(`não passa de ${MAX_THREAT_LOGS} registros`, () => {
    const previous = Array.from({ length: 40 }, (_, i) => ({ ip: `10.0.0.${i}`, isDemo: false }));
    expect(mergeThreatLogs([], previous)).toHaveLength(MAX_THREAT_LOGS);
  });
});

describe("cache local (fallback)", () => {
  it("grava e lê os registros", () => {
    const logs = parseTopIps([{ source: "1.1.1.1", targetport: 443 }], "t");
    writeCache(logs);
    expect(readCache()).toEqual([expect.objectContaining({ ip: "1.1.1.1", port: 443 })]);
  });

  it("revalida cache adulterado (XSS injetado no localStorage)", () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify([
        { id: "a", ip: "1.1.1.1", threatType: "<img src=x onerror=alert(1)>", port: 99999 },
        { id: "b", ip: "javascript:alert(1)" },
        null,
      ]),
    );
    const cached = readCache();
    expect(cached).toHaveLength(1);
    expect(cached[0].threatType).toBe("img src=x [BLOCKED]alert(1)");
    expect(cached[0].port).toBe("N/D");
  });

  it.each([
    ["JSON corrompido", "{nao-e-json"],
    ["objeto em vez de lista", '{"a":1}'],
  ])("retorna vazio para %s", (_, raw) => {
    localStorage.setItem(CACHE_KEY, raw);
    expect(readCache()).toEqual([]);
  });

  it("não quebra quando o localStorage está indisponível", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => writeCache([{ ip: "1.1.1.1" }], broken)).not.toThrow();
    expect(readCache(broken)).toEqual([]);
  });
});

describe("fetchJsonWithTimeout", () => {
  afterEach(() => vi.useRealTimers());

  it("retorna o JSON e envia o header Accept", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: 1 }));
    await expect(fetchJsonWithTimeout("https://x", 1000, fetchImpl)).resolves.toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://x",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("lança erro em HTTP não-2xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, { ok: false, status: 503 }));
    await expect(fetchJsonWithTimeout("https://x", 1000, fetchImpl)).rejects.toThrow("HTTP 503");
  });

  it("aborta a requisição ao estourar o timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url, { signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = fetchJsonWithTimeout("https://lento", 7000, fetchImpl);
    const assertion = expect(pending).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(7000);
    await assertion;
  });

  it("propaga JSON inválido como falha", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    await expect(fetchJsonWithTimeout("https://x", 1000, fetchImpl)).rejects.toThrow(SyntaxError);
  });
});

describe("fetchSansFeeds (falhas nos feeds OSINT)", () => {
  const fakeFetch = (handlers) => vi.fn((url) => handlers[url]());

  it("sucesso total", async () => {
    const fetchJson = fakeFetch({
      [SANS_ENDPOINTS.infocon]: async () => ({ status: "green" }),
      [SANS_ENDPOINTS.topIps]: async () => [{ source: "1.1.1.1" }],
    });
    const result = await fetchSansFeeds(fetchJson);
    expect(result.infocon).toBe("GREEN");
    expect(result.topIps).toHaveLength(1);
    expect(describeFeedStatus(result)).toBe("SANS ISC — Infocon: OK | Top IPs: OK");
  });

  it("falha só no Infocon ainda é sucesso parcial", async () => {
    const fetchJson = fakeFetch({
      [SANS_ENDPOINTS.infocon]: async () => {
        throw new Error("timeout");
      },
      [SANS_ENDPOINTS.topIps]: async () => [{ source: "1.1.1.1" }],
    });
    const result = await fetchSansFeeds(fetchJson);
    expect(result.infocon).toBeNull();
    expect(describeFeedStatus(result)).toBe("SANS ISC — Infocon: indisponível | Top IPs: OK");
  });

  it("falha só no Top IPs ainda é sucesso parcial", async () => {
    const fetchJson = fakeFetch({
      [SANS_ENDPOINTS.infocon]: async () => ({ status: "yellow" }),
      [SANS_ENDPOINTS.topIps]: async () => ({ unexpected: true }),
    });
    const result = await fetchSansFeeds(fetchJson);
    expect(result).toEqual({ infocon: "YELLOW", topIps: null });
  });

  it("lança erro quando os dois endpoints falham", async () => {
    const fetchJson = vi.fn().mockRejectedValue(new TypeError("Failed to fetch (CORS)"));
    await expect(fetchSansFeeds(fetchJson)).rejects.toThrow("Nenhum endpoint");
  });

  it("lança erro quando os dois respondem com payload inválido", async () => {
    const fetchJson = vi.fn().mockResolvedValue({ status: "HACKED" });
    await expect(fetchSansFeeds(fetchJson)).rejects.toThrow("Nenhum endpoint");
  });
});
