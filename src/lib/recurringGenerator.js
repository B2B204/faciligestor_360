import { RecurringTemplate } from '@/entities/RecurringTemplate';
import { AccountsPayable } from '@/entities/AccountsPayable';
import { AccountsReceivable } from '@/entities/AccountsReceivable';

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonthKey(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

function monthsBetweenInclusive(from, to) {
  const out = [];
  let cur = from;
  // safety cap to avoid runaway loops on bad data
  let guard = 0;
  while (cur <= to && guard < 600) {
    out.push(cur);
    cur = addMonthKey(cur, 1);
    guard++;
  }
  return out;
}

function dueDateFor(monthKeyStr, dayOfMonth) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  const day = Math.min(Math.max(Number(dayOfMonth) || 1, 1), 28);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Gera lançamentos (contas a pagar/receber) para todos os templates de
 * recorrência ativos do cnpj informado, cobrindo os meses pendentes até o
 * mês atual. Idempotente: usa last_generated_month para nunca duplicar.
 */
export async function generateDueRecurringEntries(cnpj) {
  if (!cnpj) return { generated: 0, templatesProcessed: 0 };

  const templates = await RecurringTemplate.filter({ cnpj, is_active: true });
  const currentMonth = monthKey(new Date());
  let generated = 0;

  for (const tpl of templates) {
    if (!tpl.start_month || tpl.start_month > currentMonth) continue;

    const lastMonth = tpl.end_month && tpl.end_month < currentMonth ? tpl.end_month : currentMonth;
    const from = tpl.last_generated_month ? addMonthKey(tpl.last_generated_month, 1) : tpl.start_month;
    if (from > lastMonth) continue;

    const pendingMonths = monthsBetweenInclusive(from, lastMonth);
    if (pendingMonths.length === 0) continue;

    const rows = pendingMonths.map((mk) => ({
      cnpj,
      contract_id: tpl.contract_id || null,
      due_date: dueDateFor(mk, tpl.day_of_month),
      competence_month: mk,
      face_value: Number(tpl.amount) || 0,
      open_amount: Number(tpl.amount) || 0,
      paid_amount: 0,
      status: 'aberto',
      category: tpl.category || 'outros',
      bank_account_id: tpl.bank_account_id || null,
      observations: `Gerado automaticamente pela recorrência "${tpl.name}"`,
      ...(tpl.type === 'payable'
        ? { supplier_name: tpl.party_name, supplier_cnpj: tpl.party_cnpj || null, document_number: `${tpl.name} ${mk}` }
        : { customer_name: tpl.party_name, document_number: `${tpl.name} ${mk}`, issue_date: dueDateFor(mk, 1) }),
    }));

    if (tpl.type === 'payable') {
      await AccountsPayable.bulkCreate(rows);
    } else {
      await AccountsReceivable.bulkCreate(rows);
    }

    generated += rows.length;
    await RecurringTemplate.update(tpl.id, { last_generated_month: pendingMonths[pendingMonths.length - 1] });
  }

  return { generated, templatesProcessed: templates.length };
}
