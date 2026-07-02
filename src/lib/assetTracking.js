/**
 * Gera um código de rastreamento curto e legível para etiquetas de QR Code
 * de ativos (ex: AST-00042). Usa a contagem atual de ativos do cnpj como
 * sequência — suficiente para identificação única em etiquetas impressas.
 */
export function generateAssetCode(sequence) {
  return `AST-${String(sequence).padStart(5, '0')}`;
}

/**
 * Localiza um ativo pelo código digitado/escaneado, aceitando o código de
 * rastreamento (qr_code) ou, como alternativa, o número de série.
 */
export function findAssetByCode(patrimonies, code) {
  const normalized = (code || '').trim().toLowerCase();
  if (!normalized) return null;
  return patrimonies.find(
    (p) => (p.qr_code || '').toLowerCase() === normalized || (p.serial_number || '').toLowerCase() === normalized
  ) || null;
}
