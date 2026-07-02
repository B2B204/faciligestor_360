import { ContractVersion } from '@/entities/ContractVersion';

const IGNORED_FIELDS = new Set([
  'id', 'cnpj', 'created_at', 'updated_at', 'created_by', 'updated_by',
  'deleted_at', 'deleted_by', 'notes',
]);

export const FIELD_LABELS = {
  contract_number: 'Número do Contrato',
  name: 'Nome',
  unidade: 'Unidade',
  client_name: 'Cliente',
  client_cnpj: 'CNPJ do Cliente',
  contractor_cnpj: 'CNPJ Contratada',
  apoio_administrativo: 'Apoio Administrativo',
  useful_link: 'Link Útil',
  monthly_value: 'Valor Mensal',
  duration_months: 'Duração (meses)',
  annual_value: 'Valor Anual',
  expected_margin: 'Margem Esperada (%)',
  number_of_employees: 'Nº de Funcionários',
  start_date: 'Data de Início',
  end_date: 'Data de Término',
  service_type: 'Tipo de Serviço',
  status: 'Status',
  observations: 'Observações',
};

function normalize(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

/**
 * Compara duas versões de um contrato e retorna a lista de campos alterados.
 */
export function diffContract(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changes = [];
  keys.forEach((key) => {
    if (IGNORED_FIELDS.has(key)) return;
    const a = normalize(before?.[key]);
    const b = normalize(after?.[key]);
    if (a !== b) {
      changes.push({
        field: key,
        label: FIELD_LABELS[key] || key,
        old: before?.[key] ?? null,
        new: after?.[key] ?? null,
      });
    }
  });
  return changes;
}

/**
 * Registra uma nova versão do contrato com o diff em relação à versão anterior.
 * Não sobrescreve nada — cada chamada cria uma linha nova em contract_versions.
 * Retorna null se não houver mudanças reais (evita ruído no histórico).
 */
export async function recordContractVersion({ contractId, cnpj, changedBy, before, after, isCreation = false }) {
  const changes = isCreation
    ? Object.entries(after || {})
        .filter(([key, value]) => !IGNORED_FIELDS.has(key) && value !== undefined && value !== null && value !== '')
        .map(([key, value]) => ({ field: key, label: FIELD_LABELS[key] || key, old: null, new: value }))
    : diffContract(before, after);

  if (!isCreation && changes.length === 0) return null;

  const existing = await ContractVersion.filter({ cnpj, contract_id: contractId });
  const nextVersion = (existing?.length || 0) + 1;

  return ContractVersion.create({
    cnpj,
    contract_id: contractId,
    version: nextVersion,
    changes,
    snapshot: after,
    change_summary: isCreation ? 'Criação do contrato' : `${changes.length} campo(s) alterado(s)`,
    changed_by: changedBy,
  });
}
