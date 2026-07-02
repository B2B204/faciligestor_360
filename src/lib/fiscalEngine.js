export const TAX_LABELS = {
  iss: 'ISS',
  pis: 'PIS',
  cofins: 'COFINS',
  csll: 'CSLL',
  inss: 'INSS',
  irrf: 'IRRF',
};

/**
 * Encontra a posição fiscal (regra) mais específica aplicável a um contrato,
 * comparando tipo de serviço e tipo de cliente. Regras mais específicas
 * (que casam nos dois critérios) vencem regras genéricas ('todos'). Se
 * nenhuma regra específica casar, usa a marcada como padrão (is_default).
 */
export function resolveFiscalPosition(contract, positions = []) {
  const active = positions.filter((p) => p.is_active !== false);
  const serviceType = contract?.service_type;
  const clientType = contract?.client_type || 'pj';

  let best = null;
  let bestScore = -1;

  for (const pos of active) {
    const serviceMatches = !pos.service_type || pos.service_type === 'todos' || pos.service_type === serviceType;
    const clientMatches = !pos.client_type || pos.client_type === 'todos' || pos.client_type === clientType;
    if (!serviceMatches || !clientMatches) continue;

    let score = 0;
    if (pos.service_type && pos.service_type !== 'todos') score += 2;
    if (pos.client_type && pos.client_type !== 'todos') score += 2;

    if (score > bestScore || (score === bestScore && (pos.priority ?? 100) < (best?.priority ?? 100))) {
      best = pos;
      bestScore = score;
    }
  }

  if (best) return best;
  return active.find((p) => p.is_default) || null;
}

/**
 * Aplica as alíquotas da posição fiscal sobre um valor base, retornando o
 * detalhamento por imposto, o total e o valor líquido (descontando a
 * retenção na fonte, quando configurada na regra).
 */
export function calculateTaxes(baseAmount, position) {
  const amount = Number(baseAmount) || 0;
  if (!position) {
    return { breakdown: [], total: 0, netAmount: amount, retainAtSource: false, position: null };
  }

  const breakdown = Object.keys(TAX_LABELS)
    .map((key) => {
      const rate = Number(position[`rate_${key}`]) || 0;
      return { key, label: TAX_LABELS[key], rate, amount: Math.round(amount * (rate / 100) * 100) / 100 };
    })
    .filter((item) => item.rate > 0);

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
  const retainAtSource = !!position.retain_at_source;

  return {
    breakdown,
    total: Math.round(total * 100) / 100,
    netAmount: retainAtSource ? Math.round((amount - total) * 100) / 100 : amount,
    retainAtSource,
    position: { id: position.id, name: position.name },
  };
}
