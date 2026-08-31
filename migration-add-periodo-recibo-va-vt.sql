-- ============================================================
-- Recibos de VA/VT: permite gerar o recibo por um período
-- customizado (ex.: 21/07 a 20/08) além do mês de competência
-- calendário, já que muitos contratos pagam VA/VT em ciclos que
-- não coincidem com o mês civil.
-- ============================================================

ALTER TABLE allowance_receipts ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE allowance_receipts ADD COLUMN IF NOT EXISTS period_end DATE;
