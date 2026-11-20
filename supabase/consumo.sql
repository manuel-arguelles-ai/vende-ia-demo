create table if not exists consumo (
  tenant_id    bigint not null references tenants(id),
  periodo      text not null,
  mensajes     int not null default 0,
  tokens_llm   bigint not null default 0,
  segundos_voz int not null default 0,
  primary key (tenant_id, periodo)
);
alter table consumo enable row level security;
drop policy if exists tenant_isolation on consumo;
create policy tenant_isolation on consumo for all to authenticated
  using (tenant_id::text = (auth.jwt()->>'tenant_id'))
  with check (tenant_id::text = (auth.jwt()->>'tenant_id'));

-- Incremento atómico (upsert sumando). SECURITY DEFINER: la llama el service_role.
create or replace function public.incr_consumo(
  p_tenant_id bigint, p_periodo text, p_mensajes int, p_tokens bigint, p_segundos_voz int
) returns void language plpgsql security definer as $$
begin
  insert into consumo (tenant_id, periodo, mensajes, tokens_llm, segundos_voz)
  values (p_tenant_id, p_periodo, p_mensajes, p_tokens, p_segundos_voz)
  on conflict (tenant_id, periodo) do update set
    mensajes     = consumo.mensajes + excluded.mensajes,
    tokens_llm   = consumo.tokens_llm + excluded.tokens_llm,
    segundos_voz = consumo.segundos_voz + excluded.segundos_voz;
end $$;
