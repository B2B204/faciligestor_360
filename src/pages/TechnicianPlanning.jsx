import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ServiceOrder } from '@/entities/ServiceOrder';
import { Employee } from '@/entities/Employee';
import { User } from '@/entities/User';
import {
  startOfWeek, addDays, format, parseISO, isValid, isWithinInterval, startOfDay, endOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarRange, ChevronLeft, ChevronRight, Users, MapPin } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';

const STATUS_COLORS = {
  'Aberta': 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  'Em Andamento': 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  'Aguardando Aprovação': 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  'Concluída': 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  'Cancelada': 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700',
};

function safeParse(dateStr) {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

function osRange(os) {
  const start = safeParse(os.opened_at) || safeParse(os.due_at);
  const end = safeParse(os.due_at) || start;
  if (!start) return null;
  return { start: startOfDay(start), end: endOfDay(end < start ? start : end) };
}

function osActiveOnDay(os, day) {
  const range = osRange(os);
  if (!range) return false;
  return isWithinInterval(startOfDay(day), { start: range.start, end: range.end }) ||
    isWithinInterval(range.start, { start: startOfDay(day), end: endOfDay(day) });
}

function OSChip({ os, onClick }) {
  const color = STATUS_COLORS[os.status] || STATUS_COLORS['Aberta'];
  return (
    <button
      onClick={() => onClick(os)}
      className={`w-full text-left text-xs rounded-md border px-1.5 py-1 mb-1 truncate hover:opacity-80 transition-opacity ${color}`}
      title={`${os.os_number} — ${os.unit_name || ''}`}
    >
      <span className="font-semibold">{os.os_number}</span>
      {os.unit_name && <span className="opacity-80"> · {os.unit_name}</span>}
    </button>
  );
}

export default function TechnicianPlanning() {
  const [employees, setEmployees] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [detailOS, setDetailOS] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await User.me();
      const [emps, os] = await Promise.all([
        Employee.filter({ cnpj: me?.cnpj, status: 'ativo' }, 'name', 1000),
        ServiceOrder.filter({ cnpj: me?.cnpj }, '-opened_at', 2000),
      ]);
      setEmployees((emps || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setOrders(os || []);
    } catch (error) {
      console.error("Erro ao carregar planejamento técnico:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'Cancelada'),
    [orders]
  );

  const ordersByEmployee = useMemo(() => {
    const map = {};
    employees.forEach((e) => { map[e.id] = []; });
    const unassigned = [];
    activeOrders.forEach((o) => {
      if (o.assignee_id && map[o.assignee_id]) map[o.assignee_id].push(o);
      else if (!o.assignee_id) unassigned.push(o);
    });
    return { map, unassigned };
  }, [employees, activeOrders]);

  const weekLabel = `${format(weekStart, 'dd/MM', { locale: ptBR })} – ${format(addDays(weekStart, 6), 'dd/MM/yyyy', { locale: ptBR })}`;

  const workload = useMemo(() => {
    return employees.map((e) => {
      const emp_orders = ordersByEmployee.map[e.id] || [];
      const thisWeek = emp_orders.filter((o) => days.some((d) => osActiveOnDay(o, d)));
      const open = emp_orders.filter((o) => o.status === 'Aberta' || o.status === 'Em Andamento');
      return { employee: e, thisWeekCount: thisWeek.length, openCount: open.length };
    });
  }, [employees, ordersByEmployee, days]);

  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarRange className="w-6 h-6 text-primary" /> Planejamento por Técnico
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Carga de trabalho semanal por funcionário — Ordens de Serviço</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setWeekStart((w) => addDays(w, -7))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium px-2 min-w-[160px] text-center">{weekLabel}</span>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setWeekStart((w) => addDays(w, 7))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="border-border" onClick={goToday}>Hoje</Button>
        </div>
      </div>

      {/* Workload KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {workload.map(({ employee, thisWeekCount, openCount }) => (
          <Card key={employee.id} className="bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-foreground truncate flex items-center gap-1">
                <Users className="w-3 h-3 text-muted-foreground shrink-0" /> {employee.name}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-primary">{thisWeekCount}</span>
                <span className="text-xs text-muted-foreground">na semana</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{openCount} OS em aberto</p>
            </CardContent>
          </Card>
        ))}
        {employees.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground col-span-full">Nenhum funcionário ativo cadastrado.</p>
        )}
      </div>

      {/* Gantt semanal */}
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Cabeçalho */}
                <div className="grid grid-cols-[160px_repeat(7,1fr)] border-b border-border bg-muted/50">
                  <div className="p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Técnico</div>
                  {days.map((d) => (
                    <div key={d.toISOString()} className="p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center border-l border-border">
                      {format(d, "EEE", { locale: ptBR })}
                      <div className="text-[10px] font-normal normal-case">{format(d, 'dd/MM')}</div>
                    </div>
                  ))}
                </div>

                {/* Linhas por técnico */}
                {employees.map((emp) => (
                  <div key={emp.id} className="grid grid-cols-[160px_repeat(7,1fr)] border-b border-border hover:bg-muted/20">
                    <div className="p-2 text-sm font-medium text-foreground truncate flex items-center">{emp.name}</div>
                    {days.map((d) => {
                      const dayOrders = (ordersByEmployee.map[emp.id] || []).filter((o) => osActiveOnDay(o, d));
                      return (
                        <div key={d.toISOString()} className="p-1.5 border-l border-border min-h-[52px]">
                          {dayOrders.map((o) => <OSChip key={o.id} os={o} onClick={setDetailOS} />)}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Não atribuídas */}
                {ordersByEmployee.unassigned.length > 0 && (
                  <div className="grid grid-cols-[160px_repeat(7,1fr)]">
                    <div className="p-2 text-sm font-medium text-muted-foreground truncate flex items-center gap-1">
                      <Badge variant="outline" className="border-border text-xs">Sem técnico</Badge>
                    </div>
                    {days.map((d) => {
                      const dayOrders = ordersByEmployee.unassigned.filter((o) => osActiveOnDay(o, d));
                      return (
                        <div key={d.toISOString()} className="p-1.5 border-l border-border min-h-[52px]">
                          {dayOrders.map((o) => <OSChip key={o.id} os={o} onClick={setDetailOS} />)}
                        </div>
                      );
                    })}
                  </div>
                )}

                {employees.length === 0 && ordersByEmployee.unassigned.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma Ordem de Serviço para exibir nesta semana.</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalhe rápido da OS */}
      <Dialog open={!!detailOS} onOpenChange={(v) => !v && setDetailOS(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{detailOS?.os_number}</DialogTitle>
          </DialogHeader>
          {detailOS && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge className={STATUS_COLORS[detailOS.status] || ''}>{detailOS.status}</Badge>
                <Badge variant="outline" className="border-border">{detailOS.priority}</Badge>
              </div>
              <p><strong className="text-foreground">Unidade:</strong> <span className="text-muted-foreground">{detailOS.unit_name || '—'}</span></p>
              <p><strong className="text-foreground">Tipo:</strong> <span className="text-muted-foreground capitalize">{detailOS.service_type || '—'}</span></p>
              <p><strong className="text-foreground">Técnico:</strong> <span className="text-muted-foreground">{detailOS.assignee_name || 'Não atribuído'}</span></p>
              <p><strong className="text-foreground">Abertura:</strong> <span className="text-muted-foreground">{detailOS.opened_at?.slice(0, 16).replace('T', ' ') || '—'}</span></p>
              <p><strong className="text-foreground">Prazo:</strong> <span className="text-muted-foreground">{detailOS.due_at?.slice(0, 16).replace('T', ' ') || '—'}</span></p>
              {detailOS.check_in_at && (
                <p className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <MapPin className="w-3 h-3" /> Check-in em {new Date(detailOS.check_in_at).toLocaleString('pt-BR')}
                </p>
              )}
              <p className="text-muted-foreground whitespace-pre-wrap border-t border-border pt-2 mt-2">{detailOS.description}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
