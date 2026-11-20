-- Alertas de fraude de formas de pago. Las escribe el server (service_role) y las
-- lee el admin del tenant vía /api/alertas (service_role + scoped por tenant_id).
-- RLS habilitada sin políticas → ningún rol authenticated la ve directo; el
-- service_role la bypasea (igual que plataforma_eventos).
create table if not exists alertas_fraude (
  id               bigserial primary key,
  tenant_id        bigint not null,
  remitente        text not null,
  autor            text not null check (autor in ('asesor','bot')),
  texto            text not null,
  numero_detectado text,
  resuelta         boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists alertas_fraude_tenant_idx on alertas_fraude (tenant_id, created_at desc);
alter table alertas_fraude enable row level security;
-- Sin políticas: solo service_role accede.
