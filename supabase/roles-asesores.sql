-- supabase/roles-asesores.sql
alter table usuarios add column if not exists nombre text;
alter table usuarios add column if not exists activo boolean not null default true;
alter table control_leads add column if not exists asignado_a bigint references usuarios(id);
-- Fix PK multi-tenant (ya existe UNIQUE (remitente, tenant_id); el upsert usa onConflict remitente,tenant_id)
-- Transaccional + idempotente: solo recrea el PK si todavía es el viejo (solo remitente).
do $$
begin
  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'control_leads'::regclass and c.contype = 'p'
      and (select array_agg(attname order by attnum) from pg_attribute
           where attrelid = c.conrelid and attnum = any(c.conkey)) = array['remitente']::name[]
  ) then
    alter table control_leads drop constraint control_leads_pkey;
    alter table control_leads add primary key (remitente, tenant_id);
  end if;
end $$;
