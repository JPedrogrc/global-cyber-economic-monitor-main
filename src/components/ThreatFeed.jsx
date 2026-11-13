import { memo } from "react";
import { Activity, CheckCircle2, ShieldAlert } from "lucide-react";

const SEVERITY_CLASS = {
  CRÍTICA: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
  ALTA: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
};
const DEFAULT_SEVERITY_CLASS = "bg-slate-700/60 text-slate-300 border border-slate-600/40";

function ThreatItem({ log }) {
  const StatusIcon = log.status === "OBSERVADO" ? Activity : CheckCircle2;
  return (
    <li className="p-3 rounded-lg bg-slate-950/90 border border-slate-800/90 flex items-start justify-between gap-2 text-xs">
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold text-cyan-300 break-all">{log.ip}</span>
          <span className="text-slate-400">:{log.port ?? "N/D"}</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
            {log.agency}
          </span>
        </div>
        <p className="text-slate-300 font-medium">{log.threatType}</p>
        <p className="text-[11px] text-slate-400">Setor: {log.targetSector}</p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            SEVERITY_CLASS[log.severity] ?? DEFAULT_SEVERITY_CLASS
          }`}
        >
          {log.severity}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-300 font-semibold">
          <StatusIcon className="w-3 h-3" aria-hidden="true" />
          {log.status}
        </span>
      </div>
    </li>
  );
}

function ThreatFeed({ logs }) {
  return (
    <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" aria-hidden="true" />
          <h2 className="text-sm font-bold text-white">Feed OSINT Tratado & Sanitizado</h2>
        </div>
        <span className="text-[11px] text-slate-400">SANS ISC (fonte conectada)</span>
      </div>

      <ul aria-label="Registros OSINT" className="space-y-2.5 overflow-y-auto max-h-96 pr-1">
        {logs.map((log) => (
          <ThreatItem key={log.id} log={log} />
        ))}
      </ul>
    </div>
  );
}

// memo: evita re-render a cada tick da telemetria (2,2 s) quando as props não mudam
const MemoThreatFeed = memo(ThreatFeed);
export { MemoThreatFeed as ThreatFeed };
