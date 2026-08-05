import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Plus, Search, List, LayoutGrid, CalendarDays, ClipboardCheck,
  Grid3x3, Table2, CalendarClock, GanttChartSquare, BarChart3, Zap, PieChart
} from "lucide-react";
import { isPast, isToday, isThisWeek } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";

import { Task } from "@/entities/Task";
import { Contract } from "@/entities/Contract";
import { TeamMember } from "@/entities/TeamMember";
import { User } from "@/entities/User";
import { TaskDependency } from "@/entities/TaskDependency";
import { generateTaskDueAlerts } from "@/lib/taskAlerts";
import { runDueDateAutomations } from "@/lib/taskAutomationEngine";
import { TASK_STATUSES, TASK_PRIORITIES, DEPARTMENTS } from "@/components/tasks/taskConstants";
import TaskListView from "@/components/tasks/TaskListView";
import TaskKanbanView from "@/components/tasks/TaskKanbanView";
import TaskCalendarView from "@/components/tasks/TaskCalendarView";
import TaskCardsView from "@/components/tasks/TaskCardsView";
import TaskTableView from "@/components/tasks/TaskTableView";
import TaskAgendaView from "@/components/tasks/TaskAgendaView";
import TaskTimelineView from "@/components/tasks/TaskTimelineView";
import TaskGanttView from "@/components/tasks/TaskGanttView";
import TaskDetailDialog from "@/components/tasks/TaskDetailDialog";

export default function TasksPage() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [view, setView] = useState("lista");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all"); // all | mine | today | week | late

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      const [taskData, contractData, teamData, dependencyData] = await Promise.all([
        Task.filter({ cnpj: currentUser.cnpj, deleted_at: null }),
        Contract.filter({ cnpj: currentUser.cnpj, deleted_at: null }),
        TeamMember.filter({ cnpj: currentUser.cnpj }),
        TaskDependency.filter({ cnpj: currentUser.cnpj }),
      ]);
      setTasks(taskData);
      setContracts(contractData);
      setTeamMembers(teamData);
      setDependencies(dependencyData);

      generateTaskDueAlerts({ cnpj: currentUser.cnpj, tasks: taskData }).catch(() => {});
      runDueDateAutomations({ cnpj: currentUser.cnpj, tasks: taskData }).catch(() => {});

      const openTaskId = searchParams.get("openTask");
      if (openTaskId) {
        const target = taskData.find((t) => t.id === openTaskId);
        if (target) {
          setSelectedTask(target);
          setDetailOpen(true);
        }
        searchParams.delete("openTask");
        setSearchParams(searchParams, { replace: true });
      }
    } catch (e) {
      console.error("Erro ao carregar tarefas:", e);
    }
    setIsLoading(false);
  };

  const contractNameById = useMemo(() => {
    const map = new Map();
    contracts.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [contracts]);

  const subtaskCountByParent = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (!t.parent_task_id) return;
      map.set(t.parent_task_id, (map.get(t.parent_task_id) || 0) + 1);
    });
    return map;
  }, [tasks]);

  const enrichedTasks = useMemo(
    () => tasks.map((t) => ({
      ...t,
      contract_name: t.contract_id ? contractNameById.get(t.contract_id) : null,
      subtask_count: subtaskCountByParent.get(t.id) || 0,
    })),
    [tasks, contractNameById, subtaskCountByParent]
  );

  const counters = useMemo(() => {
    const total = tasks.length;
    const pendentes = tasks.filter((t) => t.status === "a_fazer").length;
    const emAndamento = tasks.filter((t) => t.status === "em_andamento").length;
    const finalizadas = tasks.filter((t) => t.status === "concluida").length;
    const emAtraso = tasks.filter((t) => t.due_date && isPast(new Date(t.due_date)) && !["concluida", "cancelada"].includes(t.status)).length;
    const minhas = tasks.filter((t) => t.assignee_email === user?.email).length;
    const hoje = tasks.filter((t) => t.due_date && isToday(new Date(t.due_date))).length;
    const semana = tasks.filter((t) => t.due_date && isThisWeek(new Date(t.due_date), { weekStartsOn: 0 })).length;
    return { total, pendentes, emAndamento, finalizadas, emAtraso, minhas, hoje, semana };
  }, [tasks, user]);

  const filteredTasks = useMemo(() => {
    return enrichedTasks.filter((t) => {
      const matchesSearch =
        !searchTerm ||
        t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.contract_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.assignee_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.department?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
      const matchesAssignee = assigneeFilter === "all" || t.assignee_email === assigneeFilter;
      const matchesDepartment = departmentFilter === "all" || t.department === departmentFilter;
      const matchesContract = contractFilter === "all" || t.contract_id === contractFilter;

      let matchesQuick = true;
      if (quickFilter === "mine") matchesQuick = t.assignee_email === user?.email;
      if (quickFilter === "today") matchesQuick = t.due_date && isToday(new Date(t.due_date));
      if (quickFilter === "week") matchesQuick = t.due_date && isThisWeek(new Date(t.due_date), { weekStartsOn: 0 });
      if (quickFilter === "late") matchesQuick = t.due_date && isPast(new Date(t.due_date)) && !["concluida", "cancelada"].includes(t.status);

      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesDepartment && matchesContract && matchesQuick;
    });
  }, [enrichedTasks, searchTerm, statusFilter, priorityFilter, assigneeFilter, departmentFilter, contractFilter, quickFilter, user]);

  const handleOpenTask = (task) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedTask(null);
    setDetailOpen(true);
  };

  const handleTaskMoved = (taskId, newStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
  };

  const kpiCards = [
    { label: "Total", value: counters.total, filter: "all" },
    { label: "Pendentes", value: counters.pendentes, filter: null },
    { label: "Em Andamento", value: counters.emAndamento, filter: null },
    { label: "Em Atraso", value: counters.emAtraso, filter: "late", danger: true },
    { label: "Finalizadas", value: counters.finalizadas, filter: null },
    { label: "Minhas Tarefas", value: counters.minhas, filter: "mine" },
    { label: "Hoje", value: counters.hoje, filter: "today" },
    { label: "Esta Semana", value: counters.semana, filter: "week" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-1">Administre toda a operação da empresa através das tarefas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link to={createPageUrl("TaskTemplates")}>
              <ClipboardCheck className="w-4 h-4 mr-2" /> Modelos de Tarefas
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={createPageUrl("TaskAutomations")}>
              <Zap className="w-4 h-4 mr-2" /> Automações
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={createPageUrl("TaskReports")}>
              <PieChart className="w-4 h-4 mr-2" /> Relatórios
            </Link>
          </Button>
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Tarefa
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {kpiCards.map((kpi) => (
          <Card
            key={kpi.label}
            className={`bg-card border-border shadow-sm ${kpi.filter ? "cursor-pointer hover:shadow-md transition-shadow" : ""} ${quickFilter === kpi.filter ? "ring-2 ring-blue-400" : ""}`}
            onClick={() => kpi.filter && setQuickFilter(quickFilter === kpi.filter ? "all" : kpi.filter)}
          >
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{kpi.label}</p>
              <p className={`text-xl font-bold mt-1 ${kpi.danger ? "text-red-600" : "text-foreground"}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por título, contrato, responsável..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {TASK_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            {TASK_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os deptos</SelectItem>
            {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {teamMembers.map((m) => <SelectItem key={m.email} value={m.email}>{m.full_name || m.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Contrato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os contratos</SelectItem>
            {contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* View switcher */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "lista", label: "Lista", icon: List },
          { key: "kanban", label: "Kanban", icon: LayoutGrid },
          { key: "calendario", label: "Calendário", icon: CalendarDays },
          { key: "cards", label: "Cards", icon: Grid3x3 },
          { key: "tabela", label: "Tabela", icon: Table2 },
          { key: "agenda", label: "Agenda", icon: CalendarClock },
          { key: "timeline", label: "Timeline", icon: GanttChartSquare },
          { key: "gantt", label: "Gantt", icon: BarChart3 },
        ].map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              view === v.key ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <v.icon className="w-4 h-4" /> {v.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-muted rounded-lg" />
          <div className="h-10 bg-muted rounded-lg" />
          <div className="h-10 bg-muted rounded-lg" />
        </div>
      ) : (
        <>
          {view === "lista" && <TaskListView tasks={filteredTasks} onOpenTask={handleOpenTask} />}
          {view === "kanban" && <TaskKanbanView tasks={filteredTasks} onOpenTask={handleOpenTask} onTaskMoved={handleTaskMoved} />}
          {view === "calendario" && <TaskCalendarView tasks={filteredTasks} onOpenTask={handleOpenTask} />}
          {view === "cards" && <TaskCardsView tasks={filteredTasks} onOpenTask={handleOpenTask} />}
          {view === "tabela" && <TaskTableView tasks={filteredTasks} onOpenTask={handleOpenTask} />}
          {view === "agenda" && <TaskAgendaView tasks={filteredTasks} onOpenTask={handleOpenTask} />}
          {view === "timeline" && <TaskTimelineView tasks={filteredTasks} onOpenTask={handleOpenTask} />}
          {view === "gantt" && <TaskGanttView tasks={filteredTasks} dependencies={dependencies} onOpenTask={handleOpenTask} />}
        </>
      )}

      <TaskDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        task={selectedTask}
        contracts={contracts}
        teamMembers={teamMembers}
        allTasks={tasks}
        user={user}
        onSaved={loadData}
        onDeleted={loadData}
      />
    </div>
  );
}
