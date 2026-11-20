-- Catálogo de productos (cargado del PDF catalogo-demo.pdf, ~754 productos).
-- El stock es sembrado (el PDF no trae stock); ajustar con data real.
create table if not exists public.productos (
  id bigint generated always as identity primary key,
  seccion text,
  categoria text,
  marca text,
  nombre text not null,
  descripcion text,
  precio numeric(10,2) not null,
  presentacion text,
  stock int not null default 0,
  pagina int
);
alter table public.productos enable row level security;
create policy "lectura publica productos" on public.productos for select to anon using (true);

-- Búsqueda full-text (OR + ranking por relevancia, español). La usa lib/core/catalogo.ts vía rpc.
create or replace function public.buscar_producto(q text)
returns setof public.productos
language sql stable as $func$
  select p.*
  from public.productos p,
       websearch_to_tsquery('spanish', regexp_replace(lower(q), '\s+', ' or ', 'g')) qq
  where to_tsvector('spanish', coalesce(p.marca,'') || ' ' || p.nombre || ' ' || coalesce(p.descripcion,'')) @@ qq
  order by ts_rank(to_tsvector('spanish', coalesce(p.marca,'') || ' ' || p.nombre || ' ' || coalesce(p.descripcion,'')), qq) desc,
           p.stock desc, p.precio asc
  limit 3;
$func$;
