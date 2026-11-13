import { ALL } from "../config/constants.js";
import { sanitizeString } from "../security/sanitize.js";

const SECTOR_CHART_LABELS = {
  PRIMARIO: "Primário (Agro)",
  SECUNDARIO: "Secundário (Indústria)",
  TERCIARIO: "Terciário (Finanças/Tech)",
  ONG: "Terceiro Setor (ONGs)",
};

export const DDOS_EXTRA_BLOCKED = 14820;

export function getAvailableStates(geo, country) {
  if (country === ALL) return {};
  return geo[country]?.states ?? {};
}

export function getAvailableCities(geo, country, state) {
  if (country === ALL || state === ALL) return [];
  return getAvailableStates(geo, country)[state]?.cities ?? [];
}

function matchesFilter(selected, value) {
  return selected === ALL || selected === value;
}

function matchesQuery(org, query) {
  if (!query) return true;
  return [org.name, org.segment, org.city].some((field) =>
    field.toLowerCase().includes(query),
  );
}

/**
 * Filtro multidimensional: país, estado, município, setor e busca textual sanitizada.
 */
export function filterOrganizations(organizations, filters) {
  const { country = ALL, state = ALL, city = ALL, sector = ALL, search = "" } =
    filters;
  const query = sanitizeString(search, 60).toLowerCase();

  return organizations.filter(
    (org) =>
      matchesFilter(country, org.country) &&
      matchesFilter(state, org.state) &&
      matchesFilter(city, org.city) &&
      matchesFilter(sector, org.sector) &&
      matchesQuery(org, query),
  );
}

const round = (value, digits) => Number(value.toFixed(digits));

/**
 * Agrega volume (US$ Bi) e bloqueios (milhares) por setor para o gráfico de barras.
 */
export function summarizeBySector(organizations) {
  const groups = Object.fromEntries(
    Object.entries(SECTOR_CHART_LABELS).map(([id, setor]) => [
      id,
      { setor, volumeBi: 0, bloqueiosMil: 0 },
    ]),
  );

  for (const org of organizations) {
    const group = groups[org.sector];
    if (!group) continue;
    group.volumeBi += org.volumeUsdBi;
    group.bloqueiosMil += org.attacksBlocked24h / 1000;
  }

  return Object.values(groups).map((group) => ({
    ...group,
    volumeBi: round(group.volumeBi, 1),
    bloqueiosMil: round(group.bloqueiosMil, 2),
  }));
}

export function computeKpis(organizations, ddosSimulation = false) {
  const totalVolume = organizations.reduce((acc, o) => acc + o.volumeUsdBi, 0);
  const totalBlocked = organizations.reduce(
    (acc, o) => acc + o.attacksBlocked24h,
    0,
  );

  return {
    totalVolume: totalVolume.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
    totalBlocked: (
      totalBlocked + (ddosSimulation ? DDOS_EXTRA_BLOCKED : 0)
    ).toLocaleString("pt-BR"),
    entitiesCount: organizations.length,
    highRiskCount: organizations.filter((o) => o.cyberRisk === "ALTO").length,
  };
}
