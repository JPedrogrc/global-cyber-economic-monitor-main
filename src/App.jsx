import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { ApiModal } from "./components/ApiModal.jsx";
import { DashboardHeader } from "./components/DashboardHeader.jsx";
import { FiltersPanel } from "./components/FiltersPanel.jsx";
import { KpiCards } from "./components/KpiCards.jsx";
import { OrganizationsTable } from "./components/OrganizationsTable.jsx";
import { SecurityBar } from "./components/SecurityBar.jsx";
import { ThreatFeed } from "./components/ThreatFeed.jsx";
import { ALL } from "./config/constants.js";
import { ORGANIZATIONS_DB } from "./data/organizations.js";
import {
  computeKpis,
  filterOrganizations,
  summarizeBySector,
} from "./domain/organizations.js";
import { useOsintFeed } from "./hooks/useOsintFeed.js";
import { useTelemetryStream } from "./hooks/useTelemetryStream.js";

const DashboardCharts = lazy(() => import("./components/DashboardCharts.jsx"));

const INITIAL_FILTERS = { country: ALL, state: ALL, city: ALL, sector: ALL, search: "" };

function ChartsFallback() {
  return (
    <div className="h-80 rounded-xl bg-slate-900/70 border border-slate-800 grid place-items-center text-xs text-slate-400">
      Carregando gráficos…
    </div>
  );
}

export default function App({ fetchFeeds }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [ddosSimulation, setDdosSimulation] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);

  const osint = useOsintFeed(fetchFeeds ? { fetchFeeds } : undefined);
  const { metrics, timeSeries } = useTelemetryStream(ddosSimulation);

  const updateFilters = useCallback(
    (patch) => setFilters((prev) => ({ ...prev, ...patch })),
    [],
  );
  const closeApiModal = useCallback(() => setShowApiModal(false), []);

  const filteredOrgs = useMemo(
    () => filterOrganizations(ORGANIZATIONS_DB, filters),
    [filters],
  );
  const sectorSummary = useMemo(() => summarizeBySector(filteredOrgs), [filteredOrgs]);
  const kpis = useMemo(
    () => computeKpis(filteredOrgs, ddosSimulation),
    [filteredOrgs, ddosSimulation],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      <SecurityBar
        metrics={metrics}
        circuitState={osint.circuitState}
        ddosSimulation={ddosSimulation}
        onToggleDdos={() => setDdosSimulation((prev) => !prev)}
        onOpenApi={() => setShowApiModal(true)}
      />

      <DashboardHeader
        feedStatus={osint.feedStatus}
        infoconLevel={osint.infoconLevel}
        isSyncing={osint.isSyncing}
        onRefresh={osint.refresh}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <FiltersPanel filters={filters} onChange={updateFilters} />
        <KpiCards kpis={kpis} />

        <Suspense fallback={<ChartsFallback />}>
          <DashboardCharts timeSeries={timeSeries} sectorSummary={sectorSummary} />
        </Suspense>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <ThreatFeed logs={osint.threatLogs} />
          <OrganizationsTable organizations={filteredOrgs} />
        </section>
      </main>

      {showApiModal && <ApiModal onClose={closeApiModal} />}
    </div>
  );
}
