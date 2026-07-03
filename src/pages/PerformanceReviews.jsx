import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Employee } from '@/entities/Employee';
import { PerformanceCycle } from '@/entities/PerformanceCycle';
import { PerformanceReview } from '@/entities/PerformanceReview';
import { User } from '@/entities/User';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer
} from 'recharts';
import {
  Star, Plus, Trash2, Users2, ClipboardCheck, Trophy, Send
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';

const COMPETENCIES = [
  { key: 'qualidade', label: 'Qualidade do Trabalho' },
  { key: 'comunicacao', label: 'Comunicação' },
  { key: 'trabalho_equipe', label: 'Trabalho em Equipe' },
  { key: 'proatividade', label: 'Proatividade' },
  { key: 'pontualidade', label: 'Pontualidade e Assiduidade' },
];

const REVIEWER_TYPE_LABELS = { self: 'Autoavaliação', gestor: 'Gestor', par: 'Par', subordinado: 'Subordinado' };

function average(nums) {
  const valid = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// ─── Ciclos ────────────────────────────────────────────────────────────────

function NewCycleDialog({ open, onOpenChange, onSave }) {
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handle = async () => {
    if (!form.name) { alert('Informe o nome do ciclo.'); return; }
    setSaving(true);
    try { await onSave(form); setForm({ name: '', start_date: '', end_date: '' }); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader><DialogTitle>Novo Ciclo de Avaliação</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome *</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Avaliação 2026 - 2º Semestre" className="bg-background border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Início</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fim</Label>
              <Input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} className="bg-background border-border" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancelar</Button>
          <Button onClick={handle} disabled={saving}>{saving ? 'Salvando…' : 'Criar Ciclo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignReviewDialog({ open, onOpenChange, employees, onSave }) {
  const EMPTY = { employee_id: '', reviewer_type: 'self', reviewer_email: '', reviewer_name: '' };
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (form.reviewer_type === 'self' && form.employee_id) {
      const emp = employees.find((e) => e.id === form.employee_id);
      setForm((f) => ({ ...f, reviewer_email: emp?.email || '', reviewer_name: emp?.name || '' }));
    }
  }, [form.reviewer_type, form.employee_id, employees]);

  const handle = async () => {
    if (!form.employee_id || !form.reviewer_email) {
      alert('Selecione o funcionário avaliado e informe o e-mail do avaliador.');
      return;
    }
    setSaving(true);
    try { await onSave(form); setForm(EMPTY); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader><DialogTitle>Adicionar Avaliação ao Ciclo</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Funcionário Avaliado *</Label>
            <Select value={form.employee_id} onValueChange={(v) => set('employee_id', v)}>
              <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo de Avaliador</Label>
            <Select value={form.reviewer_type} onValueChange={(v) => set('reviewer_type', v)}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REVIEWER_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome do Avaliador</Label>
              <Input value={form.reviewer_name} onChange={(e) => set('reviewer_name', e.target.value)} disabled={form.reviewer_type === 'self'} className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">E-mail do Avaliador *</Label>
              <Input value={form.reviewer_email} onChange={(e) => set('reviewer_email', e.target.value)} disabled={form.reviewer_type === 'self'} className="bg-background border-border" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancelar</Button>
          <Button onClick={handle} disabled={saving}>{saving ? 'Salvando…' : 'Adicionar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CyclesTab({ user, employees, cycles, reviews, onChanged }) {
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [activeCycleId, setActiveCycleId] = useState(cycles[0]?.id || null);

  useEffect(() => {
    if (!activeCycleId && cycles.length) setActiveCycleId(cycles[0].id);
  }, [cycles, activeCycleId]);

  const activeCycle = cycles.find((c) => c.id === activeCycleId);
  const cycleReviews = reviews.filter((r) => r.cycle_id === activeCycleId);

  const handleCreateCycle = async (form) => {
    const created = await PerformanceCycle.create({ ...form, cnpj: user.cnpj, status: 'aberto', created_by: user.email });
    setShowNewCycle(false);
    setActiveCycleId(created.id);
    await onChanged();
  };

  const handleAssign = async (form) => {
    const emp = employees.find((e) => e.id === form.employee_id);
    await PerformanceReview.create({
      cnpj: user.cnpj,
      cycle_id: activeCycleId,
      employee_id: form.employee_id,
      employee_name: emp?.name || '',
      reviewer_email: form.reviewer_email,
      reviewer_name: form.reviewer_name || form.reviewer_email,
      reviewer_type: form.reviewer_type,
      status: 'pendente',
      created_by: user.email,
    });
    setShowAssign(false);
    await onChanged();
  };

  const removeReview = async (review) => {
    if (!window.confirm('Remover esta avaliação atribuída?')) return;
    await PerformanceReview.delete(review.id);
    await onChanged();
  };

  const closeCycle = async () => {
    await PerformanceCycle.update(activeCycleId, { status: 'encerrado' });
    await onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={activeCycleId || ''} onValueChange={setActiveCycleId}>
          <SelectTrigger className="w-64 bg-background border-border"><SelectValue placeholder="Selecionar ciclo" /></SelectTrigger>
          <SelectContent>
            {cycles.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} {c.status === 'encerrado' ? '(encerrado)' : ''}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-2 border-border" onClick={() => setShowNewCycle(true)}>
          <Plus className="w-4 h-4" /> Novo Ciclo
        </Button>
        {activeCycle && activeCycle.status === 'aberto' && (
          <>
            <Button size="sm" className="gap-2" onClick={() => setShowAssign(true)}>
              <Plus className="w-4 h-4" /> Adicionar Avaliação
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={closeCycle}>Encerrar Ciclo</Button>
          </>
        )}
      </div>

      {!activeCycle ? (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum ciclo criado ainda. Clique em "Novo Ciclo" para começar.
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                  <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Avaliado</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Avaliador</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Tipo</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right">Nota</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right pr-4">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycleReviews.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhuma avaliação atribuída neste ciclo.</TableCell></TableRow>
                ) : (
                  cycleReviews.map((r) => (
                    <TableRow key={r.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{r.employee_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.reviewer_name || r.reviewer_email}</TableCell>
                      <TableCell><Badge variant="outline" className="border-border text-xs">{REVIEWER_TYPE_LABELS[r.reviewer_type]}</Badge></TableCell>
                      <TableCell>
                        <Badge className={r.status === 'concluida' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                          {r.status === 'concluida' ? 'Concluída' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{r.overall_score ? r.overall_score.toFixed(1) : '—'}</TableCell>
                      <TableCell className="text-right pr-4">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeReview(r)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <NewCycleDialog open={showNewCycle} onOpenChange={setShowNewCycle} onSave={handleCreateCycle} />
      <AssignReviewDialog open={showAssign} onOpenChange={setShowAssign} employees={employees} onSave={handleAssign} />
    </div>
  );
}

// ─── Minhas Avaliações ──────────────────────────────────────────────────────

function ReviewForm({ review, onClose, onSubmitted }) {
  const [scores, setScores] = useState(() => Object.fromEntries(COMPETENCIES.map((c) => [c.key, 3])));
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const scoreArray = COMPETENCIES.map((c) => ({ key: c.key, label: c.label, score: scores[c.key] }));
      const overall = average(scoreArray.map((s) => s.score));
      await PerformanceReview.update(review.id, {
        scores: scoreArray,
        overall_score: Number(overall.toFixed(2)),
        comments,
        status: 'concluida',
        submitted_at: new Date().toISOString(),
      });
      onSubmitted();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!review} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avaliar {review?.employee_name} — {REVIEWER_TYPE_LABELS[review?.reviewer_type]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {COMPETENCIES.map((c) => (
            <div key={c.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-foreground">{c.label}</Label>
                <span className="text-sm font-semibold text-primary">{scores[c.key]}/5</span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScores((s) => ({ ...s, [c.key]: n }))}
                    className={`flex-1 h-8 rounded-md border text-sm font-medium transition-colors ${
                      scores[c.key] >= n ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Comentários</Label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} className="bg-background border-border resize-none" placeholder="Pontos fortes, oportunidades de melhoria…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            <Send className="w-4 h-4" /> {saving ? 'Enviando…' : 'Enviar Avaliação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MyReviewsTab({ user, reviews, onChanged }) {
  const [reviewing, setReviewing] = useState(null);
  const mine = reviews.filter((r) => r.reviewer_email === user.email);
  const pending = mine.filter((r) => r.status === 'pendente');
  const done = mine.filter((r) => r.status === 'concluida');

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <ClipboardCheck className="w-4 h-4 text-amber-500" /> Pendentes ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma avaliação pendente para você preencher.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <Card key={r.id} className="bg-card border-border shadow-sm">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.employee_name}</p>
                    <p className="text-xs text-muted-foreground">{REVIEWER_TYPE_LABELS[r.reviewer_type]}</p>
                  </div>
                  <Button size="sm" onClick={() => setReviewing(r)}>Avaliar</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Concluídas ({done.length})</h3>
        {done.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma avaliação enviada ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {done.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm rounded-md border border-border px-3 py-2">
                <span>{r.employee_name} · {REVIEWER_TYPE_LABELS[r.reviewer_type]}</span>
                <span className="font-medium text-primary">{r.overall_score?.toFixed(1)}/5</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewing && (
        <ReviewForm
          review={reviewing}
          onClose={() => setReviewing(null)}
          onSubmitted={async () => { setReviewing(null); await onChanged(); }}
        />
      )}
    </div>
  );
}

// ─── Resultados 360° ────────────────────────────────────────────────────────

function ResultsTab({ employees, cycles, reviews }) {
  const [employeeId, setEmployeeId] = useState('');
  const [cycleId, setCycleId] = useState('');

  const relevant = reviews.filter((r) => r.employee_id === employeeId && r.cycle_id === cycleId && r.status === 'concluida');

  const radarData = useMemo(() => {
    return COMPETENCIES.map((c) => {
      const selfScore = relevant.find((r) => r.reviewer_type === 'self')?.scores?.find((s) => s.key === c.key)?.score;
      const others = relevant.filter((r) => r.reviewer_type !== 'self')
        .map((r) => r.scores?.find((s) => s.key === c.key)?.score)
        .filter((n) => typeof n === 'number');
      return {
        competency: c.label,
        Autoavaliação: selfScore ?? 0,
        Outros: Number(average(others).toFixed(2)),
      };
    });
  }, [relevant]);

  const overallAvg = average(relevant.map((r) => r.overall_score));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger className="w-64 bg-background border-border"><SelectValue placeholder="Selecionar funcionário" /></SelectTrigger>
          <SelectContent>
            {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cycleId} onValueChange={setCycleId}>
          <SelectTrigger className="w-56 bg-background border-border"><SelectValue placeholder="Selecionar ciclo" /></SelectTrigger>
          <SelectContent>
            {cycles.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!employeeId || !cycleId ? (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Selecione um funcionário e um ciclo para ver o resultado 360°.
          </CardContent>
        </Card>
      ) : relevant.length === 0 ? (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma avaliação concluída para esta combinação ainda.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nota Geral (média)</p>
                <p className="text-2xl font-bold text-primary mt-1 flex items-center gap-1"><Trophy className="w-5 h-5" /> {overallAvg.toFixed(1)}/5</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Avaliações Concluídas</p>
                <p className="text-2xl font-bold text-foreground mt-1 flex items-center gap-1"><Users2 className="w-5 h-5" /> {relevant.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4">
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="competency" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Radar name="Autoavaliação" dataKey="Autoavaliação" stroke="#8884d8" fill="#8884d8" fillOpacity={0.4} />
                  <Radar name="Outros Avaliadores" dataKey="Outros" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Página Principal ───────────────────────────────────────────────────────

export default function PerformanceReviewsPage() {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await User.me();
      setUser(me);
      const [emps, cycs, revs] = await Promise.all([
        Employee.filter({ cnpj: me.cnpj, status: 'ativo' }),
        PerformanceCycle.filter({ cnpj: me.cnpj }, '-created_at'),
        PerformanceReview.filter({ cnpj: me.cnpj }, '-created_at', 5000),
      ]);
      setEmployees(emps);
      setCycles(cycs);
      setReviews(revs);
    } catch (error) {
      console.error("Erro ao carregar avaliações de desempenho:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !user) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Star className="w-6 h-6 text-primary" /> Avaliação de Desempenho 360°
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ciclos de avaliação, autoavaliação, gestor, pares e resultados consolidados</p>
      </div>

      <Tabs defaultValue="ciclos" className="w-full">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="ciclos">Ciclos</TabsTrigger>
          <TabsTrigger value="minhas">Minhas Avaliações</TabsTrigger>
          <TabsTrigger value="resultados">Resultados 360°</TabsTrigger>
        </TabsList>
        <TabsContent value="ciclos" className="mt-6">
          <CyclesTab user={user} employees={employees} cycles={cycles} reviews={reviews} onChanged={load} />
        </TabsContent>
        <TabsContent value="minhas" className="mt-6">
          <MyReviewsTab user={user} reviews={reviews} onChanged={load} />
        </TabsContent>
        <TabsContent value="resultados" className="mt-6">
          <ResultsTab employees={employees} cycles={cycles} reviews={reviews} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
