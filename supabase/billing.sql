-- =============================================================================
-- Billing schema migration — Fase 2: MercadoPago
-- Applies to: staging first, then production
-- Idempotente: safe to run multiple times
-- =============================================================================

-- 1. Columnas billing en tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS mp_preapproval_id    text,
  ADD COLUMN IF NOT EXISTS sub_estado           text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS trial_fin            timestamptz,
  ADD COLUMN IF NOT EXISTS sub_proximo_cobro    timestamptz,
  ADD COLUMN IF NOT EXISTS sub_actualizado      timestamptz;

-- 2. Tabla facturacion_eventos — log idempotente de webhooks MP
CREATE TABLE IF NOT EXISTS facturacion_eventos (
  id           bigserial PRIMARY KEY,
  tenant_id    bigint NOT NULL REFERENCES tenants(id) DEFAULT 1,
  mp_event_id  text UNIQUE,
  tipo         text,
  payload      jsonb,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facturacion_eventos_tenant_id
  ON facturacion_eventos (tenant_id);

-- RLS en facturacion_eventos (patrón del cimiento)
ALTER TABLE facturacion_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON facturacion_eventos;
CREATE POLICY tenant_isolation ON facturacion_eventos FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

-- 3. Tabla billing_config — almacena IDs de planes MP creados
-- Sin policy para authenticated → solo service_role puede operar (BYPASSRLS)
CREATE TABLE IF NOT EXISTS billing_config (
  plan                    text PRIMARY KEY,
  mp_preapproval_plan_id  text,
  actualizado             timestamptz DEFAULT now()
);

ALTER TABLE billing_config ENABLE ROW LEVEL SECURITY;
-- Sin CREATE POLICY → solo service_role (BYPASSRLS) puede leer/escribir
