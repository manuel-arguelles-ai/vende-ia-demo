-- =============================================================================
-- Allowlist — números autorizados por tenant
-- Fase A: DDL aditivo — aplica a staging primero, luego producción.
-- Idempotente: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS antes de crear.
-- service_role tiene BYPASSRLS → backend sigue funcionando sin cambios.
-- anon sin policy → con RLS on, denegado (0 filas o error de permisos).
-- authenticated con JWT claim tenant_id → ve solo sus filas.
-- =============================================================================

create table if not exists numeros_autorizados (
  id        bigserial primary key,
  tenant_id bigint not null references tenants(id) default 1,
  numero    text not null,
  etiqueta  text,
  created_at timestamptz default now(),
  unique (tenant_id, numero)
);

create index if not exists idx_numeros_autorizados_tenant_id
  on numeros_autorizados (tenant_id);

alter table numeros_autorizados enable row level security;

drop policy if exists tenant_isolation on numeros_autorizados;
create policy tenant_isolation on numeros_autorizados for all to authenticated
  using  (tenant_id::text = (auth.jwt()->>'tenant_id'))
  with check (tenant_id::text = (auth.jwt()->>'tenant_id'));
