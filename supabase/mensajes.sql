-- Memoria de conversación (multi-turno) por cliente. La usa lib/core/historial.ts.
create table if not exists public.mensajes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  remitente text not null,
  rol text not null check (rol in ('cliente','bot')),
  texto text not null,
  etapa text
);
create index if not exists idx_mensajes_remitente on public.mensajes (remitente, created_at);
alter table public.mensajes enable row level security;
create policy "lectura publica mensajes" on public.mensajes for select to anon using (true);
