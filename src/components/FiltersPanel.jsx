import { memo } from "react";
import { Filter, Search } from "lucide-react";
import { ALL } from "../config/constants.js";
import { GEO_HIERARCHY } from "../data/geoHierarchy.js";
import { SECTORS } from "../data/sectors.js";
import { getAvailableCities, getAvailableStates } from "../domain/organizations.js";

const SELECT_CLASS =
  "w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-40";

function Field({ id, label, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-slate-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Drill-down geográfico em cascata: trocar o país zera estado e município;
 * trocar o estado zera o município.
 */
function FiltersPanel({ filters, onChange }) {
  const { country, state, city, sector, search } = filters;
  const states = getAvailableStates(GEO_HIERARCHY, country);
  const cities = getAvailableCities(GEO_HIERARCHY, country, state);

  return (
    <section
      aria-labelledby="filters-title"
      className="bg-slate-900/70 border border-slate-800 rounded-xl p-4"
    >
      <h2
        id="filters-title"
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-3"
      >
        <Filter className="w-4 h-4" aria-hidden="true" />
        Drill-Down Geoespacial & Setorial
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Field id="filter-country" label="País / Região">
          <select
            id="filter-country"
            value={country}
            onChange={(e) => onChange({ country: e.target.value, state: ALL, city: ALL })}
            className={SELECT_CLASS}
          >
            {Object.entries(GEO_HIERARCHY).map(([code, data]) => (
              <option key={code} value={code}>
                {data.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="filter-state" label="Estado / Província">
          <select
            id="filter-state"
            value={state}
            onChange={(e) => onChange({ state: e.target.value, city: ALL })}
            disabled={country === ALL}
            className={SELECT_CLASS}
          >
            <option value={ALL}>Todos os Estados</option>
            {Object.entries(states).map(([code, data]) => (
              <option key={code} value={code}>
                {data.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="filter-city" label="Município">
          <select
            id="filter-city"
            value={city}
            onChange={(e) => onChange({ city: e.target.value })}
            disabled={state === ALL}
            className={SELECT_CLASS}
          >
            <option value={ALL}>Todos os Municípios</option>
            {cities.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="filter-sector" label="Setor Econômico">
          <select
            id="filter-sector"
            value={sector}
            onChange={(e) => onChange({ sector: e.target.value })}
            className={SELECT_CLASS}
          >
            {SECTORS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="filter-search" label="Buscar Organização / Segmento">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-500 absolute left-3 top-2.5"
              aria-hidden="true"
            />
            <input
              id="filter-search"
              type="search"
              maxLength={60}
              autoComplete="off"
              value={search}
              onChange={(e) => onChange({ search: e.target.value })}
              placeholder="Ex: Manaus, B3, Agro, ONG..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </Field>
      </div>
    </section>
  );
}

// memo: evita re-render a cada tick da telemetria (2,2 s) quando as props não mudam
const MemoFiltersPanel = memo(FiltersPanel);
export { MemoFiltersPanel as FiltersPanel };
