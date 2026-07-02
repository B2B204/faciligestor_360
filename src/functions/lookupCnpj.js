// Consulta CNPJ via BrasilAPI (suporta CORS no browser)
export async function lookupCnpj(cnpj) {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) throw new Error('CNPJ inválido');
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleaned}`);
  if (!res.ok) throw new Error('CNPJ não encontrado');
  const data = await res.json();
  const nome = data.nome_fantasia?.trim() || data.razao_social || '';
  const endereco = [data.logradouro, data.numero, data.municipio, data.uf]
    .filter(Boolean).join(', ');
  return {
    nome,
    razaoSocial: data.razao_social,
    cnpj: cleaned,
    logradouro: data.logradouro,
    numero: data.numero,
    municipio: data.municipio,
    uf: data.uf,
    cep: data.cep,
    endereco,
    situacao: data.descricao_situacao_cadastral,
    abertura: data.data_inicio_atividade,
    atividade: data.cnae_fiscal_descricao,
  };
}
