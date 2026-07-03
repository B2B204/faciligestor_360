-- ============================================================
-- Ordens de Servico (OS): o frontend usa varios campos que nunca
-- existiram em "service_orders" (relíquia de migração incompleta
-- do base44). Por decisão do usuário, a correção é ADICIONAR as
-- colunas faltantes ao banco, preservando a UI/lógica existente.
-- ============================================================

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS os_number TEXT,
  ADD COLUMN IF NOT EXISTS unit_name TEXT,
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS requester_name TEXT,
  ADD COLUMN IF NOT EXISTS requester_email TEXT,
  ADD COLUMN IF NOT EXISTS requester_phone TEXT,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assignee_id TEXT,
  ADD COLUMN IF NOT EXISTS assignee_name TEXT,
  ADD COLUMN IF NOT EXISTS contract_number TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_material_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_hours NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_signature_url TEXT;
