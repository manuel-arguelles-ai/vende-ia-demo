-- Resumen rodante por lead (memoria de largo plazo del agente). service_role,
-- scoped por tenant en la capa app (igual patrón que alertas_fraude/plataforma_eventos).
create table if not exists resumen_lead (
  tenant_id        bigint not null,
  remitente        text not null,
  resumen          text not null,
  turnos_resumidos int not null default 0,
  updated_at       timestamptz not null default now(),
  primary key (remitente, tenant_id)
);
alter table resumen_lead enable row level security;
-- Sin políticas: solo service_role accede.
