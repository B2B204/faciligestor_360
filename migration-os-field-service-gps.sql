-- ============================================================
-- MIGRAÇÃO: Field Service — checklist com foto/GPS, check-in/check-out
-- com geolocalização e assinatura digital do cliente nas Ordens de Serviço.
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem erro.)
-- ============================================================

-- ============================================================
-- 0. Tabelas de apoio da OS que ainda não existiam no banco
--    (checklist, horas/homem, materiais usados)
-- ============================================================
CREATE TABLE IF NOT EXISTS service_order_checklists (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj              TEXT NOT NULL,
  service_order_id  TEXT NOT NULL,
  item              TEXT NOT NULL,
  is_done           BOOLEAN DEFAULT false,
  done_at           TIMESTAMPTZ,
  done_by           TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_order_time_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj              TEXT NOT NULL,
  service_order_id  TEXT NOT NULL,
  employee_id       TEXT,
  employee_name     TEXT,
  date              DATE,
  hours             NUMERIC(10,2) DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_order_materials (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj              TEXT NOT NULL,
  service_order_id  TEXT NOT NULL,
  material_name     TEXT NOT NULL,
  quantity          NUMERIC(15,3) DEFAULT 0,
  unit              TEXT,
  unit_cost         NUMERIC(15,2) DEFAULT 0,
  total_cost        NUMERIC(15,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_so_checklists_service_order ON service_order_checklists(service_order_id);
CREATE INDEX IF NOT EXISTS idx_so_time_logs_service_order   ON service_order_time_logs(service_order_id);
CREATE INDEX IF NOT EXISTS idx_so_materials_service_order   ON service_order_materials(service_order_id);

-- ============================================================
-- 1. SERVICE_ORDERS — check-in/check-out com GPS/timestamp + assinatura
-- ============================================================
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS check_in_at        TIMESTAMPTZ;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS check_in_lat       NUMERIC(10,6);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS check_in_lng       NUMERIC(10,6);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS check_in_by        TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS check_in_accuracy  NUMERIC(10,2);

ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS check_out_at       TIMESTAMPTZ;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS check_out_lat      NUMERIC(10,6);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS check_out_lng      NUMERIC(10,6);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS check_out_by       TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS check_out_accuracy NUMERIC(10,2);

ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS customer_signature_url TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS signed_by_name       TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS signed_at            TIMESTAMPTZ;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS closing_photos       JSONB DEFAULT '[]'::jsonb;

-- ============================================================
-- 2. SERVICE_ORDER_CHECKLISTS — foto e GPS por item concluído
-- ============================================================
ALTER TABLE service_order_checklists ADD COLUMN IF NOT EXISTS photo_url  TEXT;
ALTER TABLE service_order_checklists ADD COLUMN IF NOT EXISTS done_lat   NUMERIC(10,6);
ALTER TABLE service_order_checklists ADD COLUMN IF NOT EXISTS done_lng   NUMERIC(10,6);

-- ============================================================
-- 3. RLS — habilita e cria políticas por cnpj para as tabelas novas
--    (mesmo padrão usado no restante do sistema)
-- ============================================================
ALTER TABLE service_order_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_time_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_materials  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['service_order_checklists', 'service_order_time_logs', 'service_order_materials'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %s', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON %s', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %s FOR SELECT TO authenticated USING (
         cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
       )',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_all" ON %s FOR ALL TO authenticated USING (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
