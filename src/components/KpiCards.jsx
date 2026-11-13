import { memo } from "react";
import { AlertTriangle, Server, ShieldAlert, TrendingUp } from "lucide-react";

function KpiCard({ title, icon: Icon, iconClass, value, valueClass = "text-white", note, noteClass }) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
        <h3>{title}</h3>
        <Icon className={`w-4 h-4 ${iconClass}`} aria-hidden="true" />
      </div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className={`text-xs mt-1 ${noteClass}`}>{note}</div>
    </div>
  );
}

function KpiCards({ kpis }) {
  return (
    <section aria-label="Indicadores" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Volume econômico cadastrado"
        icon={TrendingUp}
        iconClass="text-emerald-400"
        value={`US$ ${kpis.totalVolume} Bi`}
        note={`${kpis.entitiesCount} organizações cadastradas no recorte`}
        noteClass="text-emerald-400"
      />
      <KpiCard
        title="Eventos de bloqueio (dados demonstrativos / 24h)"
        icon={ShieldAlert}
        iconClass="text-rose-400"
        value={kpis.totalBlocked}
        note="Valores ilustrativos, não coletados das organizações"
        noteClass="text-rose-300"
      />
      <KpiCard
        title="Entidades com risco cadastrado alto"
        icon={AlertTriangle}
        iconClass="text-amber-400"
        value={kpis.highRiskCount}
        note="Bolsas, Big Techs e Energia sob monitoramento reforçado"
        noteClass="text-amber-300"
      />
      <KpiCard
        title="SLA informado (dados demonstrativos)"
        icon={Server}
        iconClass="text-cyan-400"
        value="99.98%"
        valueClass="text-emerald-400"
        note="Sem integração com infraestrutura real"
        noteClass="text-slate-400"
      />
    </section>
  );
}

// memo: evita re-render a cada tick da telemetria (2,2 s) quando as props não mudam
const MemoKpiCards = memo(KpiCards);
export { MemoKpiCards as KpiCards };
