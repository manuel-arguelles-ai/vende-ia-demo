-- contactos tenía PK global remitente (impide que dos tenants compartan un número).
-- Ya existe UNIQUE (remitente, tenant_id) y el upsert usa onConflict remitente,tenant_id. Idempotente.
do $$
begin
  if exists (
    select 1 from pg_constraint c
    where c.conrelid='contactos'::regclass and c.contype='p'
      and (select array_agg(attname order by attnum) from pg_attribute
           where attrelid=c.conrelid and attnum=any(c.conkey)) = array['remitente']::name[]
  ) then
    alter table contactos drop constraint contactos_pkey;
    alter table contactos add primary key (remitente, tenant_id);
  end if;
end $$;
