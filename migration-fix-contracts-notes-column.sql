-- ============================================================
-- CORREÇÃO: a coluna "notes" da tabela contracts não existe no banco
-- em produção, causando o erro ao salvar contratos:
--   Could not find the 'notes' column of 'contracts' in the schema cache
-- O Mural de Recados do contrato (ContractForm.jsx) salva "notes" como
-- um array JSON de objetos {id, text, timestamp}, então a coluna precisa
-- ser JSONB (não TEXT).
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem erro.)
-- ============================================================

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;

-- Caso a coluna já exista como TEXT (versão antiga do schema.sql), converte para JSONB.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'notes' AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE contracts ALTER COLUMN notes DROP DEFAULT;
    ALTER TABLE contracts ALTER COLUMN notes TYPE JSONB USING (
      CASE
        WHEN notes IS NULL OR notes = '' THEN '[]'::jsonb
        ELSE to_jsonb(notes)
      END
    );
    ALTER TABLE contracts ALTER COLUMN notes SET DEFAULT '[]'::jsonb;
  END IF;
END $$;
