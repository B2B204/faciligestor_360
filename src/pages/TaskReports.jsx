import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { PieChart as PieChartIcon, TrendingUp, Users, Building2, AlertTriangle, Gauge } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell
} from "recharts";
import { differenceInCalendarDays, format, startOfWeek, subDays, isAfter } from "date-fns";

import { Task } from "@/entities/Task";
import { Contract } from "@/entities/Contract";
import { User } from "@/entities/User";
import { DEPARTMENTS } from "@/components/tasks/taskConstants";

const COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899"];

export default function TaskReportsPage() {
  const [tasks, setTasks] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [periodDays, setPeriodDays] = useState("30");
  const [contractFilter, setContractFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      const [taskData, contractData] = await Promise.all([
        Task.filter({ cnpj: currentUser.cnpj, deleted_at: null }),
        Contract.filter({ cnpj: currentUser.cnpj, deleted_at: null }),
      ]);
      setTasks(taskData);
      setContracts(contractData);
    } catch (e) {
      console.error("Erro ao carregar relatórios de tarefas:", e);
    }
    setIsLoading(false);
  };

  const cutoff = useMemo(() => subDays(new Date(), Number(periodDays)), [periodDays]);

  const scopedTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesPeriod = t.created_at ? isAfter(new Date(t.created_at), cutoff) : true;
      const matchesContract = contractFilter === "all" || t.contract_id === contractFilter;
      const matchesDepartment = departmentFilter === "all" || t.department === departmentFilter;
      return matchesPeriod && matchesContract && matchesDepartment;
    });
  }, [tasks, cutoff, contractFilter, departmentFilter]);

  const completedTasks = useMemo(() => scopedTasks.filter((t) => t.status === "concluida" && t.completed_at), [scopedTasks]);

  const productivityByWeek = useMemo(() => {
    const map = new Map();
    completedTasks.forEach((t) => {
      const weekStart = format(startOfWeek(new Date(t.completed_at), { weekStartsOn: 0 }), "dd/MM");
      map.set(weekStart, (map.get(weekStart) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([semana, concluidas]) => ({ semana, concluidas }))
      .sort((a, b) => a.semana.localeCompare(b.semana));
  }, [completedTasks]);

  const topAssignees = useMemo(() => {
    const map = new Map();
    completedTasks.forEach((t) => {
      if (!t.assignee_email) return;
      map.set(t.assignee_email, (map.get(t.assignee_email) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, concluidas]) => ({ name, concluidas }))
      .sort((a, b) => b.concluidas - a.concluidas)
      .slice(0, 8);
  }, [completedTasks]);

  const byDepartment = useMemo(() => {
    const map = new Map();
    scopedTasks.forEach((t) => {
      const dept = DEPARTMENTS.find((d) => d.value === t.department)?.label || t.department || "Sem departamento";
      map.set(dept, (map.get(dept) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [scopedTasks]);

  const workload = useMemo(() => {
    const map = new Map();
    scopedTasks
      .filter((t) => !["concluida", "cancelada"].includes(t.status) && t.assignee_email)
      .forEach((t) => map.set(t.assignee_email, (map.get(t.assignee_email) || 0) + 1));
    return Array.from(map.entries())
      .map(([name, abertas]) => ({ name, abertas }))
      .sort((a, b) => b.abertas - a.abertas)
      .slice(0, 8);
  }, [scopedTasks]);

  const kpis = useMemo(() => {
    const overdue = scopedTasks.filter((t) => t.due_date && !["concluida", "cancelada"].includes(t.status) && isAfter(new Date(), new Date(t.due_date))).length;

    const durations = completedTasks
      .map((t) => {
        const start = t.start_date || t.created_at;
        if (!start) return null;
        return differenceInCalendarDays(new Date(t.completed_at), new Date(start));
      })
      .filter((d) => d != null && d >= 0);
    const avgDuration = durations.length ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) : "—";

    const withDueDate = completedTasks.filter((t) => t.due_date);
    const onTime = withDueDate.filter((t) => !isAfter(new Date(t.completed_at), new Date(t.due_date))).length;
    const sla = withDueDate.length ? Math.round((onTime / withDueDate.length) * 100) : null;

    const withPlannedDuration = completedTasks
      .map((t) => {
        if (!t.start_date || !t.due_date) return null;
        const planned = differenceInCalendarDays(new Date(t.due_date), new Date(t.start_date));
        const actual = differenceInCalendarDays(new Date(t.completed_at), new Date(t.start_date));
        if (planned <= 0 || actual < 0) return null;
        return planned / Math.max(actual, 1);
      })
      .filter((v) => v != null);
    const efficiency = withPlannedDuration.length
      ? Math.round((withPlannedDuration.reduce((a, b) => a + b, 0) / withPlannedDuration.length) * 100)
      : null;

    return { overdue, avgDuration, sla, efficiency };
  }, [scopedTasks, completedTasks]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <PieChartIcon className="w-6 h-6" /> Relatórios de Produtividade
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe produtividade, carga de trabalho e SLA das tarefas</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={periodDays} onValueChange={setPeriodDays}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Contrato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os contratos</SelectItem>
            {contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os deptos</SelectItem>
            {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Tarefas Atrasadas</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{kpis.overdue}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tempo Médio de Conclusão</p>
                <p className="text-2xl font-bold text-foreground mt-1">{kpis.avgDuration}{kpis.avgDuration !== "—" ? " dias" : ""}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /> SLA (no prazo)</p>
                <p className="text-2xl font-bold text-foreground mt-1">{kpis.sla != null ? `${kpis.sla}%` : "—"}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Eficiência (previsto/real)</p>
                <p className="text-2xl font-bold text-foreground mt-1">{kpis.efficiency != null ? `${kpis.efficiency}%` : "—"}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-500" /> Tarefas Concluídas por Semana
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={productivityByWeek}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="semana" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="concluidas" stroke="#22C55E" strokeWidth={3} dot={{ r: 4, fill: "#22C55E" }} name="Concluídas" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-500" /> Usuários Mais Produtivos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topAssignees} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={140} />
                    <Tooltip />
                    <Bar dataKey="concluidas" fill="#3B82F6" name="Concluídas" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-purple-500" /> Tarefas por Departamento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <ResponsiveContainer width="100%" height={260}>
                  <RePieChart>
                    <Pie data={byDepartment} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {byDepartment.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
                  <Gauge className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-amber-500" /> Carga de Trabalho (tarefas abertas)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={workload} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={140} />
                    <Tooltip />
                    <Bar dataKey="abertas" fill="#F59E0B" name="Tarefas abertas" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
