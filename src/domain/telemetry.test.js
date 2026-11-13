import { describe, expect, it } from "vitest";
import { MAX_SERIES_POINTS } from "../config/constants.js";
import { TokenBucketLimiter } from "../security/TokenBucketLimiter.js";
import { appendTimeSeriesPoint, isXssNeutralized, simulateTrafficCycle } from "./telemetry.js";

const frozenClock = () => 0;

describe("simulateTrafficCycle (simulação de carga / DDoS)", () => {
  it("tráfego normal dentro da capacidade: nada é descartado", () => {
    const limiter = new TokenBucketLimiter(90, 30, frozenClock);
    const cycle = simulateTrafficCycle(limiter, false, () => 0);
    expect(cycle).toEqual({ incoming: 25, accepted: 25, dropped: 0, xssBlocked: 0 });
  });

  it("rajada DDoS: aceita só a capacidade e descarta o resto", () => {
    const limiter = new TokenBucketLimiter(90, 30, frozenClock);
    const cycle = simulateTrafficCycle(limiter, true);
    expect(cycle.incoming).toBe(950);
    expect(cycle.accepted).toBe(90);
    expect(cycle.dropped).toBe(860);
    expect(cycle.accepted + cycle.dropped).toBe(cycle.incoming);
  });

  it("rajada DDoS também dispara as sondas XSS e todas são neutralizadas", () => {
    const limiter = new TokenBucketLimiter(90, 30, frozenClock);
    expect(simulateTrafficCycle(limiter, true).xssBlocked).toBe(14); // ceil(120 / 9)
  });

  it("balde vazio: ciclo seguinte descarta tudo", () => {
    const limiter = new TokenBucketLimiter(90, 30, frozenClock);
    simulateTrafficCycle(limiter, true);
    const second = simulateTrafficCycle(limiter, false, () => 0);
    expect(second).toMatchObject({ accepted: 0, dropped: 25 });
  });
});

describe("isXssNeutralized", () => {
  it.each(["<script>x</script>", "<img src=x onerror=1>", "<<svg>>"])(
    "neutraliza %s",
    (payload) => {
      expect(isXssNeutralized(payload)).toBe(true);
    },
  );
});

describe("appendTimeSeriesPoint", () => {
  it("adiciona o ponto no fim com o rótulo informado", () => {
    const next = appendTimeSeriesPoint([{ economicIndex: 100 }], {
      ddosSimulation: false,
      label: "10:00:00",
      random: () => 0.46,
    });
    expect(next.at(-1)).toEqual({
      time: "10:00:00",
      economicIndex: 100,
      cyberAttacksPerMin: Math.floor(310 + 0.46 * 260),
      mitigatedRate: 99.89,
    });
  });

  it(`mantém buffer circular de ${MAX_SERIES_POINTS} pontos (sem vazamento de memória)`, () => {
    let series = [];
    for (let i = 0; i < 100; i++) {
      series = appendTimeSeriesPoint(series, { ddosSimulation: false, label: String(i) });
    }
    expect(series).toHaveLength(MAX_SERIES_POINTS);
    expect(series.at(-1).time).toBe("99");
    expect(series[0].time).toBe(String(100 - MAX_SERIES_POINTS));
  });

  it.each([
    [134.9, 1, 135],
    [92.1, 0, 92],
  ])("limita o índice econômico entre 92 e 135 (%p)", (start, rand, expected) => {
    const next = appendTimeSeriesPoint([{ economicIndex: start }], {
      ddosSimulation: false,
      label: "x",
      random: () => rand,
    });
    expect(next.at(-1).economicIndex).toBe(expected);
  });

  it("em DDoS gera pico de eventos e usa valor padrão para série vazia", () => {
    const next = appendTimeSeriesPoint([], { ddosSimulation: true, label: "x", random: () => 0 });
    expect(next[0].cyberAttacksPerMin).toBe(1850);
    expect(next[0].economicIndex).toBe(105.63);
  });
});
