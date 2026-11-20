-- Bitácora de eventos de plataforma (altas, conexiones de WhatsApp, etc.).
-- Solo el operador (super-admin, vía service_role) la lee/escribe.
-- RLS habilitada SIN políticas → ningún rol authenticated (tenant) la ve;
-- el service_role la bypasea. Mismo patrón de aislamiento que las tablas de billing.
create table if not exists plataforma_eventos (
  id         bigserial primary key,
  tenant_id  bigint,
  tipo       text not null,
  detalle    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists plataforma_eventos_created_idx
  on plataforma_eventos (created_at desc);

alter table plataforma_eventos enable row level security;
-- Sin políticas: solo service_role accede.
