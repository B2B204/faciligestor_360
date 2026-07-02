import { Patrimony } from '@/entities/Patrimony';
import { PatrimonyDepreciationEntry } from '@/entities/PatrimonyDepreciationEntry';
import { IndirectCost } from '@/entities/IndirectCost';

const NON_DEPRECIABLE_STATUSES = new Set(['extraviado']);

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonthKey(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

function monthsBetweenInclusive(from, to) {
  const out = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 1200) {
    out.push(cur);
    cur = addMonthKey(cur, 1);
    guard++;
  }
  return out;
}

/**
 * Calcula a depreciação de um mês a partir do valor contábil atual.
 * - linear: (valor de aquisição - valor residual) / vida útil em meses.
 * - degressiva (saldos decrescentes): aplica uma taxa anual sobre o valor
 *   contábil do mês anterior. Se a taxa não for informada, usa o dobro da
 *   taxa linear (double declining balance), prática comum no método.
 */
export function computeMonthlyDepreciation(asset, bookValueBefore) {
  const acquisitionValue = Number(asset.equipment_value) || 0;
  const residual = Number(asset.residual_value) || 0;
  const usefulLifeMonths = Number(asset.useful_life_months) || 0;
  if (usefulLifeMonths <= 0) return 0;

  const remaining = Math.max(0, bookValueBefore - residual);
  if (remaining <= 0) return 0;

  if (asset.depreciation_method === 'degressiva') {
    const usefulLifeYears = usefulLifeMonths / 12;
    const annualRate = Number(asset.declining_balance_rate) || (200 / usefulLifeYears);
    const monthlyRate = annualRate / 100 / 12;
    return Math.min(remaining, bookValueBefore * monthlyRate);
  }

  // linear
  const total = Math.max(0, acquisitionValue - residual);
  const monthly = total / usefulLifeMonths;
  return Math.min(remaining, monthly);
}

/**
 * Gera os lançamentos de depreciação pendentes (mensais) para todos os
 * ativos do cnpj com método de depreciação configurado, até o mês atual.
 * Idempotente via `last_depreciation_month`. Também mantém sincronizado um
 * IndirectCost "Depreciação de Ativos" por ativo, para refletir no
 * financeiro (Custos Indiretos / Orçamento) automaticamente.
 */
export async function generateDueDepreciationEntries(cnpj) {
  if (!cnpj) return { generated: 0, assetsProcessed: 0 };

  const assets = await Patrimony.filter({ cnpj });
  const currentMonth = monthKey(new Date());
  let generated = 0;
  let assetsProcessed = 0;

  for (const asset of assets) {
    if (!asset.depreciation_method || asset.depreciation_method === 'none') continue;
    if (!asset.useful_life_months || Number(asset.useful_life_months) <= 0) continue;
    if (!asset.allocation_date) continue;
    if (NON_DEPRECIABLE_STATUSES.has(asset.status)) continue;

    const startMonth = monthKey(new Date(asset.allocation_date));
    const from = asset.last_depreciation_month ? addMonthKey(asset.last_depreciation_month, 1) : startMonth;
    if (from > currentMonth) continue;

    const pendingMonths = monthsBetweenInclusive(from, currentMonth);
    if (pendingMonths.length === 0) continue;

    let bookValue = asset.current_book_value != null ? Number(asset.current_book_value) : Number(asset.equipment_value) || 0;
    let accumulated = Number(asset.accumulated_depreciation) || 0;
    const residual = Number(asset.residual_value) || 0;
    let lastAmount = 0;
    let lastMonthGenerated = null;

    for (const mk of pendingMonths) {
      const amount = computeMonthlyDepreciation(asset, bookValue);
      if (amount <= 0) break;

      const bookBefore = bookValue;
      const accBefore = accumulated;
      bookValue = Math.max(residual, bookValue - amount);
      accumulated += amount;

      await PatrimonyDepreciationEntry.create({
        cnpj,
        patrimony_id: asset.id,
        competence_month: mk,
        method: asset.depreciation_method,
        amount,
        accumulated_before: accBefore,
        accumulated_after: accumulated,
        book_value_before: bookBefore,
        book_value_after: bookValue,
      });

      generated++;
      lastAmount = amount;
      lastMonthGenerated = mk;
    }

    if (!lastMonthGenerated) continue;
    assetsProcessed++;

    const fullyDepreciated = bookValue <= residual;
    const description = `Depreciação - ${asset.equipment_name}${asset.serial_number ? ` (Série: ${asset.serial_number})` : ''}`;

    let indirectCostId = asset.depreciation_indirect_cost_id || null;
    try {
      if (indirectCostId) {
        await IndirectCost.update(indirectCostId, {
          monthly_value: lastAmount,
          reference_month: lastMonthGenerated,
          description,
          status: fullyDepreciated ? 'inativo' : 'ativo',
        });
      } else {
        const created = await IndirectCost.create({
          cnpj,
          cost_type: 'depreciacao',
          description,
          monthly_value: lastAmount,
          reference_month: lastMonthGenerated,
          status: fullyDepreciated ? 'inativo' : 'ativo',
        });
        indirectCostId = created.id;
      }
    } catch {
      // Se o custo indireto vinculado foi excluído manualmente, ignora e segue sem travar a depreciação.
    }

    await Patrimony.update(asset.id, {
      accumulated_depreciation: accumulated,
      current_book_value: bookValue,
      last_depreciation_month: lastMonthGenerated,
      depreciation_indirect_cost_id: indirectCostId,
    });
  }

  return { generated, assetsProcessed };
}
