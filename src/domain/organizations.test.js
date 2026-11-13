import { describe, expect, it } from "vitest";
import { ALL } from "../config/constants.js";
import { GEO_HIERARCHY } from "../data/geoHierarchy.js";
import { ORGANIZATIONS_DB } from "../data/organizations.js";
import {
  computeKpis,
  DDOS_EXTRA_BLOCKED,
  filterOrganizations,
  getAvailableCities,
  getAvailableStates,
  summarizeBySector,
} from "./organizations.js";

const names = (orgs) => orgs.map((o) => o.name);
const filter = (filters) => filterOrganizations(ORGANIZATIONS_DB, filters);

describe("filtros geográficos (drill-down País -> Estado -> Município)", () => {
  it("sem filtros retorna todas as organizações", () => {
    expect(filter({})).toHaveLength(ORGANIZATIONS_DB.length);
  });

  it.each([
    ["BR", 8],
    ["US", 2],
    ["DE", 2],
    ["CN", 1],
    ["JP", 1],
  ])("país %s retorna %i organizações", (country, count) => {
    const result = filter({ country });
    expect(result).toHaveLength(count);
    expect(result.every((o) => o.country === country)).toBe(true);
  });

  it("país + estado restringe ao estado", () => {
    const result = filter({ country: "BR", state: "SP" });
    expect(result.every((o) => o.state === "SP")).toBe(true);
    expect(result).toHaveLength(3);
  });

  it("país + estado + município restringe à cidade", () => {
    expect(names(filter({ country: "BR", state: "SP", city: "Campinas" }))).toEqual([
      "Magazine Luiza / Varejo Digital",
    ]);
  });

  it("combinação inconsistente (estado de outro país) retorna vazio", () => {
    expect(filter({ country: "US", state: "SP" })).toEqual([]);
  });

  it("país desconhecido retorna vazio (não quebra)", () => {
    expect(filter({ country: "XX" })).toEqual([]);
  });

  it("combina filtro geográfico com setor", () => {
    const result = filter({ country: "BR", state: "AM", sector: "ONG" });
    expect(names(result)).toEqual(["Instituto Amazônia Sustentável (ONG)"]);
  });

  it.each(["PRIMARIO", "SECUNDARIO", "TERCIARIO", "ONG"])("setor %s isolado", (sector) => {
    const result = filter({ sector });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((o) => o.sector === sector)).toBe(true);
  });
});

describe("busca textual", () => {
  it("busca por cidade, nome e segmento sem diferenciar maiúsculas", () => {
    expect(filter({ search: "manaus" })).toHaveLength(2);
    expect(names(filter({ search: "B3" }))).toEqual(["B3 S.A. - Brasil, Bolsa, Balcão"]);
    expect(filter({ search: "BOLSA DE VALORES" })).toHaveLength(2);
  });

  it("sanitiza a busca: payload XSS não quebra o filtro", () => {
    expect(filter({ search: "<script>alert(1)</script>" })).toEqual([]);
    expect(filter({ search: "<b>Manaus</b>" })).toEqual([]);
    expect(filter({ search: "  Manaus  " })).toHaveLength(2);
  });

  it("busca contendo apenas caracteres perigosos equivale a busca vazia", () => {
    expect(filter({ search: "<>\"';" })).toHaveLength(ORGANIZATIONS_DB.length);
  });
});

describe("opções em cascata dos selects", () => {
  it("sem país não há estados nem municípios", () => {
    expect(getAvailableStates(GEO_HIERARCHY, ALL)).toEqual({});
    expect(getAvailableCities(GEO_HIERARCHY, ALL, "SP")).toEqual([]);
  });

  it("lista estados do país e cidades do estado", () => {
    expect(Object.keys(getAvailableStates(GEO_HIERARCHY, "BR"))).toEqual([
      "AM",
      "SP",
      "MT",
      "RJ",
    ]);
    expect(getAvailableCities(GEO_HIERARCHY, "BR", "AM")).toEqual(["Manaus", "Itacoatiara"]);
  });

  it("estado ALL ou inexistente não lista cidades", () => {
    expect(getAvailableCities(GEO_HIERARCHY, "BR", ALL)).toEqual([]);
    expect(getAvailableCities(GEO_HIERARCHY, "BR", "ZZ")).toEqual([]);
    expect(getAvailableStates(GEO_HIERARCHY, "XX")).toEqual({});
  });

  it("toda organização cadastrada está numa cidade presente na hierarquia", () => {
    for (const org of ORGANIZATIONS_DB) {
      expect(getAvailableCities(GEO_HIERARCHY, org.country, org.state)).toContain(org.city);
    }
  });
});

describe("agregações e KPIs", () => {
  it("summarizeBySector soma volume e bloqueios por setor", () => {
    const summary = summarizeBySector(filter({ country: "BR", state: "AM" }));
    const bySetor = Object.fromEntries(summary.map((s) => [s.setor, s]));
    expect(bySetor["Secundário (Indústria)"]).toMatchObject({ volumeBi: 38.4, bloqueiosMil: 1.42 });
    expect(bySetor["Terceiro Setor (ONGs)"]).toMatchObject({ volumeBi: 0.4, bloqueiosMil: 0.31 });
    expect(bySetor["Primário (Agro)"]).toMatchObject({ volumeBi: 0, bloqueiosMil: 0 });
  });

  it("summarizeBySector sempre devolve os 4 setores e ignora setor desconhecido", () => {
    const summary = summarizeBySector([{ sector: "X", volumeUsdBi: 1, attacksBlocked24h: 1 }]);
    expect(summary).toHaveLength(4);
    expect(summary.every((s) => s.volumeBi === 0)).toBe(true);
  });

  it("computeKpis formata em pt-BR e conta risco alto", () => {
    const kpis = computeKpis(filter({ country: "US" }));
    expect(kpis).toEqual({
      totalVolume: "2.130,0",
      totalBlocked: "98.020",
      entitiesCount: 2,
      highRiskCount: 2,
    });
  });

  it("computeKpis adiciona bloqueios extras durante simulação de DDoS", () => {
    const kpis = computeKpis([], true);
    expect(kpis.totalBlocked).toBe(DDOS_EXTRA_BLOCKED.toLocaleString("pt-BR"));
    expect(kpis.totalVolume).toBe("0,0");
  });
});
