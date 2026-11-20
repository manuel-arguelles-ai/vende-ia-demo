-- Fix multi-tenant de `negocio`: estaba single-tenant (PK en id + CHECK id=1, sin unique en tenant_id),
-- por eso el upsert onConflict:'tenant_id' fallaba (500) para todo tenant y solo Nina (id=1) tenía fila.
-- La vuelve 1-fila-por-tenant keyed por tenant_id. Idempotente.
do $$
begin
  alter table negocio drop constraint if exists negocio_id_check;
  alter table negocio drop constraint if exists negocio_pkey;
  if not exists (select 1 from pg_constraint where conrelid='negocio'::regclass and contype='p') then
    alter table negocio add primary key (tenant_id);
  end if;
end $$;
