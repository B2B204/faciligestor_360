import { Contract } from '@/entities/Contract';
import { Repactuacao } from '@/entities/Repactuacao';
import { Seguro } from '@/entities/Seguro';
import { Laudo } from '@/entities/Laudo';
import { Alert } from '@/entities/Alert';
import { format, differenceInCalendarDays, parseISO, isValid, startOfDay } from 'date-fns';

// Camadas de antecedência para vencimentos (dias restantes) — quanto menor, mais urgente.
const EXPIRY_TIERS = [90, 60, 30];
// Camadas de SLA para reajustes/repactuações pendentes (dias desde a solicitação) — quanto maior, mais urgente.
const READJUSTMENT_SLA_TIERS = [30, 60, 90];
const OPEN_READJUSTMENT_STATUSES = ['solicitada', 'aprovada'];

function safeDate(value) {
  if (!value) return null;
  try {
    const d = typeof value === 'string' ? parseISO(value) : new Date(value);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

function getContractEndDate(c) {
  if (c.end_date) return safeDate(c.end_date);
  if (c.start_date && typeof c.duration_months === 'number') {
    const d = safeDate(c.start_date);
    if (!d) return null;
    d.setMonth(d.getMonth() + c.duration_months);
    return d;
  }
  return null;
}

/**
 * Gera alertas operacionais (vencimento de contrato em camadas de 30/60/90 dias,
 * SLA de reajuste/repactuação pendente, seguros e laudos a vencer) para o cnpj
 * informado. Idempotente: nunca duplica o mesmo alerta (chave = tipo+entidade+camada).
 */
export async function generateOperationalAlerts(cnpj, userEmail) {
  if (!cnpj) return { created: 0 };

  const today = startOfDay(new Date());

  const [contracts, repactuacoes, seguros, laudos, existingAlerts] = await Promise.all([
    Contract.filter({ cnpj, status: 'ativo' }),
    Repactuacao.filter({ cnpj }),
    Seguro.filter({ cnpj }),
    Laudo.filter({ cnpj }),
    Alert.filter({ cnpj }),
  ]);

  const existingKey = (type, entityId, tier) => `${type}|${entityId}|${tier ?? ''}`;
  const existingSet = new Set(existingAlerts.map((a) => existingKey(a.type, a.entity_id, a.tier)));
  const toCreate = [];

  const addAlert = (payload) => {
    const key = existingKey(payload.type, payload.entity_id, payload.tier);
    if (existingSet.has(key)) return;
    existingSet.add(key);
    toCreate.push(payload);
  };

  // 1. Vencimento de contrato — camadas 90/60/30 dias
  contracts.forEach((c) => {
    const end = getContractEndDate(c);
    if (!end) return;
    const daysLeft = differenceInCalendarDays(end, today);
    if (daysLeft < 0) return;
    EXPIRY_TIERS.forEach((tier) => {
      if (daysLeft <= tier) {
        addAlert({
          type: 'contract_expiry',
          tier,
          entity_id: c.id,
          entity_type: 'Contract',
          due_date: format(end, 'yyyy-MM-dd'),
          status: 'pending',
          message: `Contrato "${c.name}" vence em ${daysLeft} dia(s) (${format(end, 'dd/MM/yyyy')}) — alerta de ${tier} dias.`,
        });
      }
    });
  });

  // 2. SLA de reajuste/repactuação pendente — camadas 30/60/90 dias desde a solicitação
  repactuacoes
    .filter((r) => OPEN_READJUSTMENT_STATUSES.includes(r.status_licitacao) && r.data_solicitacao)
    .forEach((r) => {
      const requestedAt = safeDate(r.data_solicitacao);
      if (!requestedAt) return;
      const daysSince = differenceInCalendarDays(today, requestedAt);
      const contractName = contracts.find((c) => c.id === r.contract_id)?.name || 'contrato';
      READJUSTMENT_SLA_TIERS.forEach((tier) => {
        if (daysSince >= tier) {
          addAlert({
            type: 'contract_readjustment_sla',
            tier,
            entity_id: r.id,
            entity_type: 'Repactuacao',
            due_date: null,
            status: 'pending',
            message: `Reajuste do contrato "${contractName}" está pendente há ${daysSince} dia(s) desde a solicitação (${format(requestedAt, 'dd/MM/yyyy')}) — SLA de ${tier} dias estourado.`,
          });
        }
      });
    });

  // 3. Seguros a vencer (30 dias)
  seguros.forEach((s) => {
    const end = safeDate(s.termino_vigencia);
    if (!end) return;
    const daysLeft = differenceInCalendarDays(end, today);
    if (daysLeft >= 0 && daysLeft <= 30) {
      addAlert({
        type: 'insurance_expiry',
        tier: 30,
        entity_id: s.id,
        entity_type: 'Seguro',
        due_date: format(end, 'yyyy-MM-dd'),
        status: 'pending',
        message: `Seguro ${s.apolice || ''} prestes a expirar em ${daysLeft} dia(s) (${format(end, 'dd/MM/yyyy')}).`,
      });
    }
  });

  // 4. Laudos a vencer (30 dias)
  laudos.forEach((l) => {
    const end = safeDate(l.validade);
    if (!end) return;
    const daysLeft = differenceInCalendarDays(end, today);
    if (daysLeft >= 0 && daysLeft <= 30) {
      addAlert({
        type: 'laudo_expiry',
        tier: 30,
        entity_id: l.id,
        entity_type: 'Laudo',
        due_date: format(end, 'yyyy-MM-dd'),
        status: 'pending',
        message: `Laudo ${l.tipo_laudo || ''} prestes a expirar em ${daysLeft} dia(s) (${format(end, 'dd/MM/yyyy')}).`,
      });
    }
  });

  for (const alert of toCreate) {
    await Alert.create({ ...alert, cnpj, recipients: userEmail ? [userEmail] : [] });
  }

  return { created: toCreate.length };
}
