-- ============================================================
-- Funcionarios: o frontend (EmployeeForm, BulkUpdateForm,
-- CSVImport, EmployeeList) usa varios campos de remuneracao/
-- beneficios e uniforme que nunca existiram em "employees".
-- Por decisao do usuario, a correcao e ADICIONAR as colunas
-- faltantes ao banco, preservando a UI/logica existente.
-- ============================================================

ALTER TABLE employees
  -- Remuneracao / beneficios
  ADD COLUMN IF NOT EXISTS base_salary NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_allowance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_plan NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_benefits NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_charges_percentage NUMERIC DEFAULT 40,
  ADD COLUMN IF NOT EXISTS total_salary NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS benefits_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_charges_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_shift TEXT,
  -- Uniforme (complementa shirt/pants/boot/jacket ja existentes)
  ADD COLUMN IF NOT EXISTS uniform_pants_modeling TEXT,
  ADD COLUMN IF NOT EXISTS uniform_boot_steel_toe BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS uniform_gloves_size TEXT,
  ADD COLUMN IF NOT EXISTS uniform_hat_size TEXT,
  ADD COLUMN IF NOT EXISTS uniform_notes TEXT,
  -- Contato / diversos
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS useful_link TEXT,
  -- Soft delete
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT;
