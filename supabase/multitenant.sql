-- =============================================================================
-- Multi-tenant schema migration
-- Applies to: staging first, then production
-- Order: new tables → add tenant_id nullable → insert tenant 1 → backfill → NOT NULL → indexes
-- =============================================================================

-- 1. New tables
create table if not exists tenants (
  id bigserial primary key,
  slug text unique not null,
  nombre text not null,
  rubro text,
  estado text default 'activo',
  plan text default 'free',
  created_at timestamptz default now()
);

create table if not exists usuarios (
  id bigserial primary key,
  tenant_id bigint not null references tenants(id),
  email text unique not null,
  password_hash text not null,
  rol text not null default 'admin',
  created_at timestamptz default now()
);

create table if not exists canales (
  id bigserial primary key,
  tenant_id bigint not null references tenants(id),
  tipo text not null,
  widget_key uuid unique default gen_random_uuid(),
  config jsonb default '{}',
  estado text default 'activo'
);

create table if not exists agente_perfil (
  tenant_id bigint primary key references tenants(id),
  nombre_bot text,
  tono text,
  instrucciones_extra text
);

-- 2. Add tenant_id to existing tables (nullable first to allow backfill)
alter table pedidos add column if not exists tenant_id bigint references tenants(id);
alter table mensajes add column if not exists tenant_id bigint references tenants(id);
alter table productos add column if not exists tenant_id bigint references tenants(id);
alter table contactos add column if not exists tenant_id bigint references tenants(id);
alter table negocio add column if not exists tenant_id bigint references tenants(id);
alter table control_leads add column if not exists tenant_id bigint references tenants(id);
alter table etiquetas_leads add column if not exists tenant_id bigint references tenants(id);
alter table cierres add column if not exists tenant_id bigint references tenants(id);
alter table notas add column if not exists tenant_id bigint references tenants(id);
alter table recordatorios add column if not exists tenant_id bigint references tenants(id);

-- 3. Insert Tienda Demo as tenant #1
insert into tenants (id, slug, nombre, rubro)
  values (1, 'tienda-demo', 'Tienda Demo', 'orgánicos')
  on conflict (id) do nothing;
select setval('tenants_id_seq', 1, true);

-- 4. Backfill all existing rows to tenant 1
update pedidos set tenant_id = 1 where tenant_id is null;
update mensajes set tenant_id = 1 where tenant_id is null;
update productos set tenant_id = 1 where tenant_id is null;
update contactos set tenant_id = 1 where tenant_id is null;
update negocio set tenant_id = 1 where tenant_id is null;
update control_leads set tenant_id = 1 where tenant_id is null;
update etiquetas_leads set tenant_id = 1 where tenant_id is null;
update cierres set tenant_id = 1 where tenant_id is null;
update notas set tenant_id = 1 where tenant_id is null;
update recordatorios set tenant_id = 1 where tenant_id is null;

-- 5. Make tenant_id NOT NULL
alter table pedidos alter column tenant_id set not null;
alter table mensajes alter column tenant_id set not null;
alter table productos alter column tenant_id set not null;
alter table contactos alter column tenant_id set not null;
alter table negocio alter column tenant_id set not null;
alter table control_leads alter column tenant_id set not null;
alter table etiquetas_leads alter column tenant_id set not null;
alter table cierres alter column tenant_id set not null;
alter table notas alter column tenant_id set not null;
alter table recordatorios alter column tenant_id set not null;

-- 5b. Composite unique constraints for multi-tenant upserts
-- contactos: old PK was (remitente) global — add UNIQUE (remitente, tenant_id) so upserts isolate by tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'contactos'::regclass
      AND conname  = 'contactos_remitente_tenant_id_key'
  ) THEN
    ALTER TABLE contactos ADD CONSTRAINT contactos_remitente_tenant_id_key UNIQUE (remitente, tenant_id);
  END IF;
END $$;

-- control_leads: old PK was (remitente) global — add UNIQUE (remitente, tenant_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'control_leads'::regclass
      AND conname  = 'control_leads_remitente_tenant_id_key'
  ) THEN
    ALTER TABLE control_leads ADD CONSTRAINT control_leads_remitente_tenant_id_key UNIQUE (remitente, tenant_id);
  END IF;
END $$;

-- etiquetas_leads: drop old 2-col unique (remitente, etiqueta) and replace with (remitente, etiqueta, tenant_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'etiquetas_leads'::regclass
      AND conname  = 'etiquetas_leads_remitente_etiqueta_key'
  ) THEN
    ALTER TABLE etiquetas_leads DROP CONSTRAINT etiquetas_leads_remitente_etiqueta_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'etiquetas_leads'::regclass
      AND conname  = 'etiquetas_leads_remitente_etiqueta_tenant_id_key'
  ) THEN
    ALTER TABLE etiquetas_leads ADD CONSTRAINT etiquetas_leads_remitente_etiqueta_tenant_id_key UNIQUE (remitente, etiqueta, tenant_id);
  END IF;
END $$;

-- 6. Indexes
create index if not exists idx_pedidos_tenant_id on pedidos (tenant_id);
create index if not exists idx_mensajes_tenant_id on mensajes (tenant_id);
create index if not exists idx_productos_tenant_id on productos (tenant_id);
create index if not exists idx_contactos_tenant_id on contactos (tenant_id);
create index if not exists idx_negocio_tenant_id on negocio (tenant_id);
create index if not exists idx_control_leads_tenant_id on control_leads (tenant_id);
create index if not exists idx_etiquetas_leads_tenant_id on etiquetas_leads (tenant_id);
create index if not exists idx_cierres_tenant_id on cierres (tenant_id);
create index if not exists idx_notas_tenant_id on notas (tenant_id);
create index if not exists idx_recordatorios_tenant_id on recordatorios (tenant_id);

-- =============================================================================
-- 7. Row Level Security (RLS) — Task 9
-- Solo aplica a STAGING. No ejecutar en producción sin autorización.
-- Idempotente: DROP POLICY IF EXISTS antes de CREATE POLICY.
-- service_role tiene BYPASSRLS → no necesita policies (backend sigue funcionando).
-- anon no tiene policies → con RLS on, 0 filas / denegado (cierra fuga Realtime).
-- authenticated con JWT claim tenant_id → ve solo sus filas.
-- =============================================================================

-- Eliminar policies anon preexistentes que abrían SELECT sin restricción
-- (necesario para que anon quede denegado cuando no hay policy para ese rol)
DROP POLICY IF EXISTS "lectura publica pedidos" ON pedidos;
DROP POLICY IF EXISTS "lectura publica mensajes" ON mensajes;
DROP POLICY IF EXISTS "lectura publica productos" ON productos;

-- Activar RLS en tablas con tenant_id
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE negocio ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE etiquetas_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cierres ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE canales ENABLE ROW LEVEL SECURITY;
ALTER TABLE agente_perfil ENABLE ROW LEVEL SECURITY;

-- Activar RLS en tenants (PK id, sin tenant_id)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Policies para tablas con columna tenant_id (13 tablas)
DROP POLICY IF EXISTS tenant_isolation ON pedidos;
CREATE POLICY tenant_isolation ON pedidos FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

DROP POLICY IF EXISTS tenant_isolation ON mensajes;
CREATE POLICY tenant_isolation ON mensajes FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

DROP POLICY IF EXISTS tenant_isolation ON productos;
CREATE POLICY tenant_isolation ON productos FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

DROP POLICY IF EXISTS tenant_isolation ON contactos;
CREATE POLICY tenant_isolation ON contactos FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

DROP POLICY IF EXISTS tenant_isolation ON negocio;
CREATE POLICY tenant_isolation ON negocio FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

DROP POLICY IF EXISTS tenant_isolation ON control_leads;
CREATE POLICY tenant_isolation ON control_leads FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

DROP POLICY IF EXISTS tenant_isolation ON etiquetas_leads;
CREATE POLICY tenant_isolation ON etiquetas_leads FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

DROP POLICY IF EXISTS tenant_isolation ON cierres;
CREATE POLICY tenant_isolation ON cierres FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

DROP POLICY IF EXISTS tenant_isolation ON notas;
CREATE POLICY tenant_isolation ON notas FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

DROP POLICY IF EXISTS tenant_isolation ON recordatorios;
CREATE POLICY tenant_isolation ON recordatorios FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

DROP POLICY IF EXISTS tenant_isolation ON usuarios;
CREATE POLICY tenant_isolation ON usuarios FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

DROP POLICY IF EXISTS tenant_isolation ON canales;
CREATE POLICY tenant_isolation ON canales FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

DROP POLICY IF EXISTS tenant_isolation ON agente_perfil;
CREATE POLICY tenant_isolation ON agente_perfil FOR ALL TO authenticated
  USING (tenant_id::text = (auth.jwt()->>'tenant_id'))
  WITH CHECK (tenant_id::text = (auth.jwt()->>'tenant_id'));

-- Policy especial para tenants (PK id, sin columna tenant_id)
DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants FOR ALL TO authenticated
  USING (id::text = (auth.jwt()->>'tenant_id'));
