import React, { useEffect, useMemo, useState } from 'react';
import { ContractVersion } from '@/entities/ContractVersion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent
} from '@/components/ui/collapsible';
import {
  History, ArrowRight, Search, ChevronDown, ChevronUp,
  PlusCircle, Eye, PackageOpen
} from 'lucide-react';
import { FIELD_LABELS } from '@/lib/contractVersioning';

const CURRENCY_FIELDS = new Set(['monthly_value', 'annual_value']);
const DATE_FIELDS = new Set(['start_date', 'end_date']);
const PERCENT_FIELDS = new Set(['expected_margin']);
const SKIP_SNAPSHOT_FIELDS = new Set([
  'id', 'cnpj', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
  'created_by_id', 'created_date', 'updated_date',
]);

// Ordem preferencial de exibição do snapshot completo
const FIELD_ORDER = [
  'contract_number', 'name', 'unidade', 'client_name', 'client_cnpj',
  'contractor_cnpj', 'apoio_administrativo', 'client_type', 'service_type',
  'status', 'monthly_value', 'annual_value', 'duration_months',
  'start_date', 'end_date', 'expected_margin', 'number_of_employees',
  'useful_link', 'observations', 'description', 'address', 'city', 'state',
  'responsible', 'task_template_id', 'notes', 'created_by', 'updated_by',
];

function formatValue(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (CURRENCY_FIELDS.has(field)) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  }
  if (PERCENT_FIELDS.has(field)) {
    return `${value}%`;
  }
  if (DATE_FIELDS.has(field) && typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
  }
  if (field === 'notes' && Array.isArray(value)) {
    return `${value.length} recado(s)`;
  }
  if (Array.isArray(value)) return `${value.length} item(ns)`;
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

function formatSnapshotValue(field, value) {
  if (value === null || value === undefined || value === '') return null;
  if (field === 'notes' && Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.map((n) => {
      const when = n?.timestamp ? new Date(n.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
      return `${when ? `[${when}] ` : ''}${n?.text || ''}`;
    }).join('\n');
  }
  return formatValue(field, value);
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
}

function VersionChange({ change }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-medium text-foreground min-w-[140px]">{change.label}:</span>
      {change.old === null || change.old === undefined || change.old === '' ? (
        <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
          <PlusCircle className="w-3 h-3" />
          <span className="font-medium">{formatValue(change.field, change.new)}</span>
          <span className="text-muted-foreground font-normal">(preenchido)</span>
        </span>
      ) : (
        <>
          <span className="text-muted-foreground line-through max-w-[45%] overflow-hidden text-ellipsis whitespace-nowrap">
            {formatValue(change.field, change.old)}
          </span>
          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-foreground font-medium max-w-[45%] overflow-hidden text-ellipsis whitespace-nowrap">
            {formatValue(change.field, change.new)}
          </span>
        </>
      )}
    </div>
  );
}

function SnapshotView({ snapshot }) {
  const orderedKeys = useMemo(() => {
    const entries = Object.entries(snapshot || {}).filter(([k, v]) => {
      if (SKIP_SNAPSHOT_FIELDS.has(k)) return false;
      return formatSnapshotValue(k, v) !== null;
    });
    const byPriority = [...entries].sort(([a], [b]) => {
      const ia = FIELD_ORDER.indexOf(a);
      const ib = FIELD_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return byPriority;
  }, [snapshot]);

  if (orderedKeys.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhum dado registrado nesta versão.</p>;
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      {orderedKeys.map(([key, value], i) => {
        const formatted = formatSnapshotValue(key, value);
        const isLong = typeof formatted === 'string' && formatted.length > 160;
        return (
          <div
            key={key}
            className={`px-3 py-2 text-xs flex gap-3 ${i % 2 ? 'bg-muted/30' : 'bg-background'} ${i > 0 ? 'border-t border-border' : ''}`}
          >
            <span className="font-medium text-muted-foreground w-[140px] shrink-0">
              {FIELD_LABELS[key] || key}
            </span>
            <span className="text-foreground whitespace-pre-wrap break-words min-w-0">
              {isLong ? (
                <LongText text={formatted} />
              ) : (
                formatted
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LongText({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!expanded) {
    return (
      <>
        <span className="inline">{text.slice(0, 160)}…</span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="ml-1 text-primary hover:underline font-medium"
        >
          ver mais
        </button>
      </>
    );
  }
  return (
    <>
      {text}
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="ml-1 text-primary hover:underline font-medium"
      >
        ver menos
      </button>
    </>
  );
}

export default function ContractHistoryDialog({ open, onOpenChange, contract }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSnapshots, setExpandedSnapshots] = useState({});

  useEffect(() => {
    if (open && contract) {
      setLoading(true);
      setSearchTerm('');
      setExpandedSnapshots({});
      ContractVersion.filter({ contract_id: contract.id }, '-version')
        .then(setVersions)
        .finally(() => setLoading(false));
    }
  }, [open, contract]);

  const matchesSearch = (v, term) => {
    if (!term) return true;
    const q = term.toLowerCase();
    const haystack = JSON.stringify({
      summary: v.change_summary,
      changed_by: v.changed_by,
      changes: v.changes,
      snapshot: v.snapshot,
    }).toLowerCase();
    return haystack.includes(q);
  };

  const filteredVersions = useMemo(
    () => versions.filter((v) => matchesSearch(v, searchTerm.trim())),
    [versions, searchTerm]
  );

  const toggleSnapshot = (id) => {
    setExpandedSnapshots((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const lastVersion = versions[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border max-h-[88vh] flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Histórico do Contrato — {contract?.name}
          </DialogTitle>

          {versions.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {versions.length} versão(ns) · Última alteração em {fmtDateTime(lastVersion?.created_at)}
              {lastVersion?.changed_by ? ` por ${lastVersion.changed_by}` : ''}
            </p>
          )}

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 bg-background border-border"
              placeholder="Buscar no histórico (ex: gordura, valor, data)…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum histórico registrado ainda para este contrato.</p>
          ) : filteredVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma versão corresponde à busca "{searchTerm}".</p>
          ) : (
            <div className="space-y-4">
              {filteredVersions.map((v, idx) => {
                const isCreation = v.change_summary === 'Criação do contrato';
                const snapshotOpen = !!expandedSnapshots[v.id];
                return (
                  <div key={v.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="border-border">v{v.version}</Badge>
                        {isCreation ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                            Criação
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                            Alteração
                          </Badge>
                        )}
                        <span className="text-sm font-medium text-foreground">{v.change_summary}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {fmtDateTime(v.created_at)}{v.changed_by ? ` · ${v.changed_by}` : ''}
                      </span>
                    </div>

                    {!isCreation && Array.isArray(v.changes) && v.changes.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        {v.changes.map((c, i) => (
                          <VersionChange key={i} change={c} />
                        ))}
                      </div>
                    )}

                    {isCreation && v.snapshot && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                        <PackageOpen className="w-3.5 h-3.5" />
                        Contrato criado com {Object.keys(v.snapshot).filter((k) => !SKIP_SNAPSHOT_FIELDS.has(k) && formatSnapshotValue(k, v.snapshot[k]) !== null).length} campo(s) preenchido(s).
                      </p>
                    )}

                    {v.snapshot && (
                      <Collapsible open={snapshotOpen} onOpenChange={() => toggleSnapshot(v.id)} className="mt-3">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                          >
                            {snapshotOpen
                              ? <ChevronUp className="w-3.5 h-3.5" />
                              : <ChevronDown className="w-3.5 h-3.5" />}
                            <Eye className="w-3.5 h-3.5" />
                            {snapshotOpen ? 'Ocultar contrato nesta versão' : 'Ver contrato completo nesta versão'}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <SnapshotView snapshot={v.snapshot} />
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
