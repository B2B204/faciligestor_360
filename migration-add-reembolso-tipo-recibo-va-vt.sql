-- ============================================================
-- Recibos de VA/VT: adiciona campo de reembolso por funcionário
-- e o tipo de recibo gerado (va | vt | ambos), para permitir
-- gerar o recibo de VA e o de VT separadamente.
-- ============================================================

ALTER TABLE allowance_receipts ADD COLUMN IF NOT EXISTS reembolso NUMERIC(15,2) DEFAULT 0;
ALTER TABLE allowance_receipts ADD COLUMN IF NOT EXISTS receipt_type TEXT DEFAULT 'ambos';
