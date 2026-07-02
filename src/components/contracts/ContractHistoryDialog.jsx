import React, { useEffect, useState } from 'react';
import { ContractVersion } from '@/entities/ContractVersion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { History, ArrowRight } from 'lucide-react';

const CURRENCY_FIELDS = new Set(['monthly_value', 'annual_value']);
const DATE_FIELDS = new Set(['start_date', 'end_date']);
const PERCENT_FIELDS = new Set(['expected_margin']);

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
  if (Array.isArray(value)) return `${value.length} item(ns)`;
  return String(value);
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
}

export default function ContractHistoryDialog({ open, onOpenChange, contract }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && contract) {
      setLoading(true);
      ContractVersion.filter({ contract_id: contract.id }, '-version')
        .then(setVersions)
        .finally(() => setLoading(false));
    }
  }, [open, contract]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Histórico do Contrato — {contract?.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum histórico registrado ainda para este contrato.</p>
        ) : (
          <div className="space-y-4 py-2">
            {versions.map((v) => (
              <div key={v.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-border">v{v.version}</Badge>
                    <span className="text-sm font-medium text-foreground">{v.change_summary}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{fmtDateTime(v.created_at)} · {v.changed_by}</span>
                </div>
                {Array.isArray(v.changes) && v.changes.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {v.changes.map((c, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-medium text-foreground min-w-[140px]">{c.label}:</span>
                        <span className="text-muted-foreground line-through">{formatValue(c.field, c.old)}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-foreground font-medium">{formatValue(c.field, c.new)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
