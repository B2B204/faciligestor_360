-- ============================================================
-- migration-fix-employees-cpf-unique.sql
-- Corrige CPFs duplicados por CNPJ antes de criar índice único
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1) Listar duplicados (para conferência manual)
-- Mostra cnpj, cpf normalizado, quantidade e ids envolvidos
SELECT
  cnpj,
  regexp_replace(cpf, '\D', '', 'g') AS cpf_digits,
  count(*) AS qtd,
  array_agg(id) AS ids,
  array_agg(name) AS nomes,
  array_agg(status) AS statuses
FROM employees
WHERE cpf IS NOT NULL AND regexp_replace(cpf, '\D', '', 'g') <> ''
GROUP BY cnpj, regexp_replace(cpf, '\D', '', 'g')
HAVING count(*) > 1
ORDER BY qtd DESC;

-- 2) Detalhamento das linhas duplicadas (para decidir o que manter)
SELECT e.*
FROM employees e
JOIN (
  SELECT cnpj, regexp_replace(cpf, '\D', '', 'g') AS cpf_digits
  FROM employees
  WHERE cpf IS NOT NULL AND regexp_replace(cpf, '\D', '', 'g') <> ''
  GROUP BY cnpj, regexp_replace(cpf, '\D', '', 'g')
  HAVING count(*) > 1
) dup ON dup.cnpj = e.cnpj AND dup.cpf_digits = regexp_replace(e.cpf, '\D', '', 'g')
ORDER BY e.cnpj, regexp_replace(e.cpf, '\D', '', 'g'), e.updated_at DESC;

-- 3) Deduplicação automática (mantém 1 por grupo)
-- Critério: mantém o mais relevante — prioriza status='ativo' e depois o mais recente (updated_at/created_at).
-- As demais linhas são removidas. REVISE o SELECT acima antes de executar o DELETE.
-- Se preferir não apagar, comente o DELETE e trate manualmente.

-- CUIDADO: faça backup antes! Ex: create table employees_backup_20260203 as select * from employees;

WITH ranked AS (
  SELECT
    id,
    cnpj,
    regexp_replace(cpf, '\D', '', 'g') AS cpf_digits,
    ROW_NUMBER() OVER (
      PARTITION BY cnpj, regexp_replace(cpf, '\D', '', 'g')
      ORDER BY
        CASE WHEN status = 'ativo' THEN 0 ELSE 1 END,  -- ativo primeiro
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id
    ) AS rn
  FROM employees
  WHERE cpf IS NOT NULL AND regexp_replace(cpf, '\D', '', 'g') <> ''
)
DELETE FROM employees
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 4) Verificar se ainda há duplicados (deve retornar 0 linhas)
SELECT
  cnpj,
  regexp_replace(cpf, '\D', '', 'g') AS cpf_digits,
  count(*) AS qtd
FROM employees
WHERE cpf IS NOT NULL AND regexp_replace(cpf, '\D', '', 'g') <> ''
GROUP BY cnpj, regexp_replace(cpf, '\D', '', 'g')
HAVING count(*) > 1;

-- 5) Criar índice único (só terá sucesso se o passo 4 retornar 0 linhas)
CREATE UNIQUE INDEX IF NOT EXISTS employees_cnpj_cpf_unique
  ON employees (cnpj, regexp_replace(cpf, '\D', '', 'g'))
  WHERE cpf IS NOT NULL AND regexp_replace(cpf, '\D', '', 'g') <> '';

-- 6) Opcional: garantir que a validação ocorra também em updates/inserts
-- O índice acima já bloqueia duplicados. Mensagem de erro do Postgres será 23505.
-- O frontend (Employees.jsx + CSVImport.jsx) já faz validação amigável antes e
-- orienta a atualizar o cadastro existente.
