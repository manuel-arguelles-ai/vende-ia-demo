alter table productos add column if not exists sku text;
alter table productos add column if not exists tags text[];
alter table productos add column if not exists atributos jsonb;
-- Índice único COMPUESTO (no parcial): en Postgres los NULL son distintos, así que
-- permite muchas filas con sku NULL por tenant Y enforça unicidad de (tenant_id, sku)
-- cuando sku no es null. Debe ser NO parcial para que ON CONFLICT (tenant_id,sku) lo use vía PostgREST.
create unique index if not exists ux_productos_tenant_sku on productos(tenant_id, sku);
