export const PERMISSIONS = {
  admin: {
    pages: ['all'],
    actions: ['all'],
  },
  gestor: {
    pages: ['all'],
    actions: ['all', 'approve_measurements'],
  },
  rh: {
    pages: ['all'],
    actions: ['view', 'create', 'edit', 'delete', 'edit_rh'],
  },
  financeiro: {
    pages: ['all'],
    actions: ['view', 'create', 'edit', 'delete', 'edit_financeiro'],
  },
  compras: {
    pages: ['all'],
    actions: ['view', 'create', 'edit', 'delete', 'edit_compras'],
  },
  comercial: {
    pages: ['all'],
    actions: ['view', 'create', 'edit', 'delete', 'edit_comercial'],
  },
};

export const hasPageAccess = (role, pageName) => {
  const userRole = role || 'comercial';
  const permissions = PERMISSIONS[userRole] || PERMISSIONS['comercial'];
  if (!permissions) return false;
  if (permissions.pages.includes('all')) return true;
  const systemPages = ['Dashboard','Contracts','ReajusteContratual','Employees','Financial','Reports','Profile','Measurements','Uniforms','Patrimony','Supplies','IndirectCosts','Marketplace','AccessDeniedPage','SegurosLaudos','AccountsReceivable','Oficios','AllowanceReceipts','Recognitions','CRM','Alerts','Marketing','Support','Tasks','TaskTemplates','TaskAutomations','TaskReports'];
  if (systemPages.includes(pageName)) {
    return permissions.pages.includes(pageName);
  }
  return false;
};

export const canPerformAction = (role, action) => {
  const userRole = role || 'comercial';
  const permissions = PERMISSIONS[userRole] || PERMISSIONS['comercial'];
  if (!permissions) return false;
  if (permissions.actions.includes('all')) return true;
  return permissions.actions.includes(action);
};

export const canManageSegurosLaudos = (role) => {
  const userRole = role || 'comercial';
  return ['admin', 'gestor', 'comercial'].includes(userRole);
};

export const canAccessCRM = (role) => {
  return true; // CRM acessível para todos os perfis (edições seguem regras por ação)
};

export const canViewAllDeals = (role) => {
  const userRole = role || 'comercial';
  return userRole === 'admin' || canPerformAction(userRole, 'crm_all');
};

export const canApproveMeasurements = (role) => {
  const userRole = role || 'comercial';
  return ['admin', 'gestor'].includes(userRole);
};

// Regras de edição por área
export const canEditPage = (role, pageName) => {
  const r = role || 'comercial';
  if (['admin', 'gestor'].includes(r)) return true; // Gestor e Admin podem editar tudo

  const RH_PAGES = ['Employees', 'AllowanceReceipts'];
  const FIN_PAGES = ['Financial', 'AccountsReceivable', 'IndirectCosts'];
  const COMPRAS_PAGES = ['Supplies', 'Patrimony', 'Uniforms'];
  const COMERCIAL_PAGES = ['CRM', 'Contracts', 'ReajusteContratual', 'SegurosLaudos'];

  if (r === 'rh') return RH_PAGES.includes(pageName);
  if (r === 'financeiro') return FIN_PAGES.includes(pageName);
  if (r === 'compras') return COMPRAS_PAGES.includes(pageName);
  if (r === 'comercial') return COMERCIAL_PAGES.includes(pageName);
  return false;
};