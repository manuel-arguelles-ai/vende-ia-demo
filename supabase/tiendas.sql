-- Tiendas físicas por inquilino (puntos de recojo para venta/reserva).
create table if not exists tiendas (
  id         bigint generated always as identity primary key,
  tenant_id  bigint not null references tenants(id),
  nombre     text not null,
  direccion  text,
  distrito   text,
  horario    text,
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists tiendas_tenant_idx on tiendas (tenant_id);

alter table tiendas enable row level security;
drop policy if exists tenant_isolation on tiendas;
create policy tenant_isolation on tiendas for all to authenticated
  using (tenant_id::text = (auth.jwt()->>'tenant_id'))
  with check (tenant_id::text = (auth.jwt()->>'tenant_id'));
