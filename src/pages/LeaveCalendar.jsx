import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Employee } from '@/entities/Employee';
import { EmployeeLeave } from '@/entities/EmployeeLeave';
import { User } from '@/entities/User';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, format, isSameMonth, isSameDay, isWithinInterval, startOfDay, parseISO, isValid
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Check, X, Trash2, Palmtree
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';

const LEAVE_TYPE_LABELS = {
  ferias: 'Férias',
  atestado: 'Atestado',
  falta_justificada: 'Falta Justificada',
  falta_injustificada: 'Falta Injustificada',
  licenca: 'Licença',
  outros: 'Outros',
};

const LEAVE_TYPE_COLORS = {
  ferias: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  atestado: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  falta_justificada: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  falta_injustificada: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  licenca: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800',
  outros: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
};

const STATUS_LABELS = { pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Rejeitado' };

function safeParse(dateStr) {
  if (!dateStr) return null;
  try { const d = parseISO(dateStr); return isValid(d) ? d : null; } catch { return null; }
}

function leaveActiveOnDay(leave, day) {
  const start = safeParse(leave.start_date);
  const end = safeParse(leave.end_date) || start;
  if (!start) return false;
  return isWithinInterval(startOfDay(day), { start: startOfDay(start), end: startOfDay(end) });
}

const EMPTY_FORM = { employee_id: '', leave_type: 'ferias', start_date: '', end_date: '', status: 'aprovado', notes: '' };

function LeaveDialog({ open, onOpenChange, employees, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(EMPTY_FORM); }, [open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handle = async () => {
    if (!form.employee_id || !form.start_date || !form.end_date) {
      alert('Preencha funcionário, início e fim.');
      return;
    }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Palmtree className="w-5 h-5 text-primary" /> Nova Ausência/Férias
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Funcionário *</Label>
            <Select value={form.employee_id} onValueChange={(v) => set('employee_id', v)}>
              <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={form.leave_type} onValueChange={(v) => set('leave_type', v)}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Início *</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fim *</Label>
              <Input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} className="bg-background border-border" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Observações</Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="bg-background border-border resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancelar</Button>
          <Button onClick={handle} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LeaveCalendar() {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const me = await User.me();
    setUser(me);
    const [emps, lvs] = await Promise.all([
      Employee.filter({ cnpj: me.cnpj }),
      EmployeeLeave.filter({ cnpj: me.cnpj }, '-start_date', 2000),
    ]);
    setEmployees(emps);
    setLeaves(lvs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const employeeName = (id) => employees.find((e) => e.id === id)?.name || 'Funcionário';

  const handleSave = async (form) => {
    await EmployeeLeave.create({
      ...form,
      cnpj: user.cnpj,
      employee_name: employeeName(form.employee_id),
      created_by: user.email,
      ...(form.status === 'aprovado' ? { approved_by: user.email, approved_at: new Date().toISOString() } : {}),
    });
    setShowForm(false);
    await load();
  };

  const updateStatus = async (leave, status) => {
    await EmployeeLeave.update(leave.id, {
      status,
      approved_by: user.email,
      approved_at: new Date().toISOString(),
    });
    await load();
  };

  const removeLeave = async (leave) => {
    if (!window.confirm('Excluir esta ausência?')) return;
    await EmployeeLeave.delete(leave.id);
    await load();
  };

  const pendingLeaves = leaves.filter((l) => l.status === 'pendente');
  const dayLeaves = selectedDay ? leaves.filter((l) => leaveActiveOnDay(l, selectedDay)) : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" /> Férias e Ausências
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Calendário integrado de férias, atestados e faltas</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nova Ausência
        </Button>
      </div>

      {pendingLeaves.length > 0 && (
        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">{pendingLeaves.length} solicitação(ões) pendente(s) de aprovação</p>
            {pendingLeaves.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 text-sm bg-card rounded-md border border-border px-3 py-2">
                <span>
                  <strong>{l.employee_name || employeeName(l.employee_id)}</strong> · {LEAVE_TYPE_LABELS[l.leave_type]} · {l.start_date} a {l.end_date}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 gap-1 border-border" onClick={() => updateStatus(l, 'aprovado')}>
                    <Check className="w-3.5 h-3.5" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 border-border text-red-600" onClick={() => updateStatus(l, 'rejeitado')}>
                    <X className="w-3.5 h-3.5" /> Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-2 capitalize min-w-[140px] text-center">{format(month, 'MMMM yyyy', { locale: ptBR })}</span>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="border-border" onClick={() => setMonth(startOfMonth(new Date()))}>Hoje</Button>
      </div>

      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <div className="grid grid-cols-7">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                <div key={d} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center py-2 border-b border-border bg-muted/50">{d}</div>
              ))}
              {days.map((day) => {
                const activeLeaves = leaves.filter((l) => leaveActiveOnDay(l, day));
                const outOfMonth = !isSameMonth(day, month);
                const today = isSameDay(day, new Date());
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-[90px] p-1.5 border-b border-r border-border text-left align-top hover:bg-muted/30 transition-colors ${outOfMonth ? 'opacity-40' : ''}`}
                  >
                    <span className={`text-xs inline-flex items-center justify-center w-5 h-5 rounded-full ${today ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground'}`}>
                      {format(day, 'd')}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {activeLeaves.slice(0, 3).map((l) => (
                        <div key={l.id} className={`text-[10px] rounded border px-1 py-0.5 truncate ${LEAVE_TYPE_COLORS[l.leave_type]} ${l.status === 'pendente' ? 'opacity-60 italic' : ''}`}>
                          {l.employee_name || employeeName(l.employee_id)}
                        </div>
                      ))}
                      {activeLeaves.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1">+{activeLeaves.length - 3} mais</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <LeaveDialog open={showForm} onOpenChange={setShowForm} employees={employees} onSave={handleSave} />

      <Dialog open={!!selectedDay} onOpenChange={(v) => !v && setSelectedDay(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selectedDay && format(selectedDay, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          {dayLeaves.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma ausência neste dia.</p>
          ) : (
            <div className="space-y-2">
              {dayLeaves.map((l) => (
                <div key={l.id} className="rounded-lg border border-border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-foreground">{l.employee_name || employeeName(l.employee_id)}</span>
                    <Badge className={LEAVE_TYPE_COLORS[l.leave_type]}>{LEAVE_TYPE_LABELS[l.leave_type]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{l.start_date} a {l.end_date} · {STATUS_LABELS[l.status]}</p>
                  {l.notes && <p className="text-xs text-muted-foreground">{l.notes}</p>}
                  <div className="flex items-center gap-1.5 pt-1">
                    {l.status === 'pendente' && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 gap-1 border-border" onClick={() => updateStatus(l, 'aprovado')}>
                          <Check className="w-3.5 h-3.5" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 border-border text-red-600" onClick={() => updateStatus(l, 'rejeitado')}>
                          <X className="w-3.5 h-3.5" /> Rejeitar
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-red-500" onClick={() => removeLeave(l)}>
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
