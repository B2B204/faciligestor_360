import { DataAccessLog } from '@/entities/DataAccessLog';

// Registra acesso/alteração a dados pessoais sensíveis, para atender ao
// dever de rastreabilidade da LGPD (art. 37). Nunca deve interromper a
// operação principal — uma falha ao logar não pode impedir o usuário de
// salvar/excluir o registro.
export async function logDataAccess({ user, action, resourceType, resourceId, resourceLabel, details }) {
  if (!user?.cnpj) return;
  try {
    await DataAccessLog.create({
      cnpj: user.cnpj,
      actor_email: user.email,
      action,
      resource_type: resourceType,
      resource_id: resourceId || null,
      resource_label: resourceLabel || null,
      details: details || null,
    });
  } catch (err) {
    console.warn('[lgpdAudit] falha ao registrar log de acesso:', err);
  }
}
