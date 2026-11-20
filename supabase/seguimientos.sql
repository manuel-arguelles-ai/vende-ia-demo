-- B1/B5 — seguimiento proactivo (re-enganche de cotización abandonada + postventa).
-- Log de toques enviados (dedupe + medición de ROI) y opt-out por contacto.
create table if not exists public.seguimientos (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references tenants(id),
  remitente text not null,
  tipo text not null check (tipo in ('reenganche','postventa')),
  toque int not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_seguimientos_tenant_rem on public.seguimientos (tenant_id, remitente, created_at);
alter table public.seguimientos enable row level security;

-- Opt-out de marketing por contacto (el motor de seguimiento lo respeta).
alter table public.contactos add column if not exists optout_marketing boolean not null default false;

-- El flag por-inquilino seguimiento_auto vive en negocio.datos (jsonb), default false:
-- NO se envía nada hasta que un inquilino lo active explícitamente.
