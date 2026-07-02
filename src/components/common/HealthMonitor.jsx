import React, { useEffect, useState } from "react";
import { Contract } from "@/entities/Contract";
import { Employee } from "@/entities/Employee";
import { FinancialEntry } from "@/entities/FinancialEntry";
import { Supply } from "@/entities/Supply";
import { Patrimony } from "@/entities/Patrimony";
import { Oficio } from "@/entities/Oficio";
import { Deal } from "@/entities/Deal";
import { MonitoringLog } from "@/entities/MonitoringLog";
import { SendEmail } from "@/integrations/Core";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle } from "lucide-react";

const MODULES = [
  { key: "contracts", label: "Contratos", fn: Contract },
  { key: "employees", label: "Funcionários", fn: Employee },
  { key: "financial", label: "Financeiro", fn: FinancialEntry },
  { key: "supplies", label: "Suprimentos", fn: Supply },
  { key: "patrimony", label: "Patrimônio", fn: Patrimony },
  { key: "oficios", label: "Ofícios", fn: Oficio },
  { key: "crm", label: "CRM", fn: Deal },
];

export default function HealthMonitor({ user }) {
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);

  const statusBadge = (s) => (
    <Badge className={s === "online" ? "bg-green-100 text-green-800" : s === "slow" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>
      {s === "online" ? "🟢 Online" : s === "slow" ? "🟠 Lento" : "🔴 Offline"}
    </Badge>
  );

  const runCheck = async () => {
    setRunning(true);
    const cnpj = user?.cnpj;
    const entries = [];
    for (const m of MODULES) {
      const started = performance.now();
      let status = "online";
      let error_message = "";
      try {
        const p = m.fn.filter({ cnpj });
        const withTimeout = Promise.race([
          p,
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout > 6s")), 6000))
        ]);
        await withTimeout;
        const dt = performance.now() - started;
        status = dt > 1500 ? (dt > 6000 ? "offline" : "slow") : "online";
        entries.push({ module: m.key, status, response_time_ms: Math.round(dt), error_message: "" });
      } catch (e) {
        const dt = performance.now() - started;
        status = "offline";
        error_message = e.message || "Erro desconhecido";
        entries.push({ module: m.key, status, response_time_ms: Math.round(dt), error_message });
        // Notificar admin
        await MonitoringLog.create({
          module: m.key, status, response_time_ms: Math.round(dt),
          error_message, checked_at: new Date().toISOString(), cnpj, notified: true
        });
        if (user?.email) {
          await SendEmail({
            to: user.email,
            subject: `Alerta: Módulo ${m.label} está offline`,
            body: `Detectamos falha no módulo ${m.label}.\n\nErro: ${error_message}\nCNPJ: ${cnpj}\nHorário: ${new Date().toLocaleString()}`
          });
        }
      }
    }
    setResults(entries);
    setRunning(false);
  };

  useEffect(() => {
    if (user?.cnpj) runCheck();
     
  }, [user?.cnpj]);

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center text-sm sm:text-base">
          <Activity className="w-5 h-5 mr-2 text-blue-500" /> Status dos Módulos
        </CardTitle>
        <Button onClick={runCheck} disabled={running} variant="outline">
          {running ? "Verificando..." : "Reverificar"}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {results.map((r) => (
          <div key={r.module} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border">
            <span className="text-sm capitalize">{r.module}</span>
            {statusBadge(r.status)}
            <span className="text-xs text-gray-500">{r.response_time_ms}ms</span>
            {r.error_message && <AlertTriangle className="w-4 h-4 text-red-500" />}
          </div>
        ))}
        {results.length === 0 && <span className="text-sm text-gray-500">Sem dados ainda.</span>}
      </CardContent>
    </Card>
  );
}