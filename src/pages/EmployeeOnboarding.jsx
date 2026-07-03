import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Employee } from '@/entities/Employee';
import { EmployeeTask } from '@/entities/EmployeeTask';
import { HrChecklistTemplate } from '@/entities/HrChecklistTemplate';
import { User } from '@/entities/User';
import { generateEmployeeTasks } from '@/lib/hrOnboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import EmployeeTaskChecklist from '@/components/employees/EmployeeTaskChecklist';
import {
  ClipboardList, Plus, Trash2, UserPlus, UserMinus, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';

const TYPE_LABELS = { onboarding: 'Admissão', offboarding: 'Demissão' };

function TemplateManager({ templates, onChanged, cnpj, userEmail }) {
  const [type, setType] = useState('onboarding');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = templates.filter((t) => t.type === type).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const add = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await HrChecklistTemplate.create({
        cnpj,
        type,
        title: title.trim(),
        category: category.trim() || null,
        sort_order: filtered.length,
        is_active: true,
        created_by: userEmail,
      });
      setTitle('');
      setCategory('');
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (tpl) => {
    await HrChecklistTemplate.update(tpl.id, { is_active: !tpl.is_active });
    onChanged();
  };

  const remove = async (tpl) => {
    if (!window.confirm(`Remover o modelo "${tpl.title}"? Isso não afeta checklists já gerados.`)) return;
    await HrChecklistTemplate.delete(tpl.id);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="w-full sm:w-44">
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="onboarding">Admissão</SelectItem>
              <SelectItem value="offboarding">Demissão</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Tarefa</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Assinar contrato de experiência" className="bg-background border-border" />
        </div>
        <div className="w-full sm:w-48">
          <Label className="text-xs text-muted-foreground">Categoria (opcional)</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Documentação" className="bg-background border-border" />
        </div>
        <Button onClick={add} disabled={saving || !title.trim()} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Adicionar
        </Button>
      </div>

      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum modelo de {TYPE_LABELS[type].toLowerCase()} cadastrado.</p>
        ) : (
          filtered.map((tpl) => (
            <div key={tpl.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm ${tpl.is_active ? 'text-foreground' : 'text-muted-foreground line-through'}`}>{tpl.title}</span>
                {tpl.category && <span className="text-xs text-muted-foreground">· {tpl.category}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => toggleActive(tpl)}>
                  {tpl.is_active ? 'Desativar' : 'Ativar'}
                </Button>
                <button onClick={() => remove(tpl)} className="text-red-500 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EmployeeProcessCard({ employee, tasks, user, onChanged, type }) {
  const [open, setOpen] = useState(false);
  const items = tasks.filter((t) => t.type === type);
  const done = items.filter((t) => t.is_done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-4">
        <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
          <div className="flex items-center gap-2">
            {type === 'onboarding' ? <UserPlus className="w-4 h-4 text-green-500" /> : <UserMinus className="w-4 h-4 text-red-500" />}
            <span className="font-medium text-foreground text-sm">{employee.name}</span>
            <Badge variant="outline" className="border-border text-xs">{employee.role || '—'}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{done}/{items.length} concluídas</span>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>
        <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
          <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
        </div>
        {open && (
          <div className="mt-3">
            <EmployeeTaskChecklist tasks={items} user={user} onChanged={onChanged} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EmployeeOnboardingPage() {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('onboarding');
  const [backfilling, setBackfilling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await User.me();
      setUser(me);
      const [emps, empTasks, tpls] = await Promise.all([
        Employee.filter({ cnpj: me.cnpj }),
        EmployeeTask.filter({ cnpj: me.cnpj }, '-created_at', 5000),
        HrChecklistTemplate.filter({ cnpj: me.cnpj }),
      ]);
      setEmployees(emps);
      setTasks(empTasks);
      setTemplates(tpls);
    } catch (error) {
      console.error("Erro ao carregar dados de onboarding:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const processesByType = useMemo(() => {
    const employeeIdsWithTasks = new Set(tasks.map((t) => t.employee_id));
    return employees
      .filter((e) => employeeIdsWithTasks.has(e.id) && tasks.some((t) => t.employee_id === e.id && t.type === tab))
      .map((e) => ({ employee: e, tasks: tasks.filter((t) => t.employee_id === e.id) }));
  }, [employees, tasks, tab]);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      let generated = 0;
      for (const emp of employees) {
        const type = emp.status === 'inativo' ? 'offboarding' : 'onboarding';
        const result = await generateEmployeeTasks({ employeeId: emp.id, cnpj: user.cnpj, type, userEmail: user.email });
        generated += result.generated || 0;
      }
      await load();
      alert(generated > 0 ? `${generated} tarefa(s) geradas para funcionários sem checklist.` : 'Todos os funcionários já possuem checklist gerado.');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" /> Onboarding / Offboarding
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Checklist de admissão e demissão por funcionário</p>
        </div>
        <Button variant="outline" onClick={handleBackfill} disabled={backfilling || loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${backfilling ? 'animate-spin' : ''}`} /> Gerar Pendentes
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="onboarding">Admissões em Andamento</TabsTrigger>
          <TabsTrigger value="offboarding">Demissões em Andamento</TabsTrigger>
          <TabsTrigger value="templates">Modelos de Checklist</TabsTrigger>
        </TabsList>

        {['onboarding', 'offboarding'].map((t) => (
          <TabsContent key={t} value={t} className="mt-6 space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : processesByType.length === 0 ? (
              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum processo de {TYPE_LABELS[t].toLowerCase()} em andamento.
                </CardContent>
              </Card>
            ) : (
              processesByType.map(({ employee, tasks: empTasks }) => (
                <EmployeeProcessCard
                  key={employee.id}
                  employee={employee}
                  tasks={empTasks}
                  user={user}
                  type={t}
                  onChanged={load}
                />
              ))
            )}
          </TabsContent>
        ))}

        <TabsContent value="templates" className="mt-6">
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <TemplateManager templates={templates} onChanged={load} cnpj={user?.cnpj} userEmail={user?.email} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
