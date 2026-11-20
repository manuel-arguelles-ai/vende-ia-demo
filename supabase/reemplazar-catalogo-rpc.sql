-- Atomic delete + insert for catalog replacement.
-- Runs inside a single transaction so a failure never leaves the catalog empty.
create or replace function public.reemplazar_catalogo(p_tenant_id bigint, p_filas jsonb)
returns int language plpgsql security definer as $$
declare n int;
begin
  delete from productos where tenant_id = p_tenant_id;
  insert into productos (tenant_id, nombre, marca, categoria, descripcion, precio, presentacion, stock, sku, tags, atributos, embedding)
  select p_tenant_id, x.nombre, x.marca, x.categoria, x.descripcion, x.precio, x.presentacion, x.stock, x.sku, x.tags, x.atributos,
         case when x.embedding is null then null else (x.embedding)::text::vector end
  from jsonb_to_recordset(p_filas) as x(nombre text, marca text, categoria text, descripcion text, precio numeric, presentacion text, stock int, sku text, tags text[], atributos jsonb, embedding jsonb);
  get diagnostics n = row_count;
  return n;
end $$;
