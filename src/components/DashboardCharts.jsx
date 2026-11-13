// Carregado sob demanda (React.lazy) para tirar o Recharts do bundle inicial.
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOOLTIP_STYLE = {
  backgroundColor: "#0f172a",
  borderColor: "#334155",
  borderRadius: "8px",
  fontSize: "12px",
};
const LEGEND_STYLE = { fontSize: "12px" };

function Gradient({ id, color }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={color} stopOpacity={0.35} />
      <stop offset="95%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  );
}

function TimeSeriesChart({ data }) {
  return (
    <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white">
            Simulação local: Índice ilustrativo vs. pressão de ataques
          </h2>
          <p className="text-xs text-slate-400">
            Série demonstrativa gerada no navegador; não representa telemetria econômica ou
            ataques observados.
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
          Simulação
        </span>
      </div>

      <div className="h-72 w-full" role="img" aria-label="Gráfico de área do índice econômico e eventos simulados por minuto">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <Gradient id="colorAttacks" color="#f43f5e" />
              <Gradient id="colorEcon" color="#06b6d4" />
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
            <YAxis yAxisId="left" stroke="#06b6d4" fontSize={11} />
            <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" fontSize={11} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="economicIndex"
              name="Índice Econômico Global"
              stroke="#06b6d4"
              fillOpacity={1}
              fill="url(#colorEcon)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="cyberAttacksPerMin"
              name="Eventos simulados / min"
              stroke="#f43f5e"
              fillOpacity={1}
              fill="url(#colorAttacks)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SectorChart({ data }) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-white">Exposição por Setor Econômico</h2>
        <p className="text-xs text-slate-400">
          Volume cadastrado (US$ Bi) vs. bloqueios demonstrativos (milhares)
        </p>
      </div>

      <div className="h-72 w-full" role="img" aria-label="Gráfico de barras do volume e bloqueios por setor">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" stroke="#64748b" fontSize={11} />
            <YAxis dataKey="setor" type="category" stroke="#94a3b8" fontSize={11} width={115} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Bar dataKey="volumeBi" name="Volume (US$ Bi)" fill="#10b981" radius={[0, 4, 4, 0]} />
            <Bar
              dataKey="bloqueiosMil"
              name="Bloqueios demonstrativos (k)"
              fill="#f59e0b"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DashboardCharts({ timeSeries, sectorSummary }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <TimeSeriesChart data={timeSeries} />
      <SectorChart data={sectorSummary} />
    </section>
  );
}
