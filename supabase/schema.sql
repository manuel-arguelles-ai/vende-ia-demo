create table if not exists public.pedidos (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  canal text not null,
  remitente text not null,
  mensaje_crudo text not null,
  producto text,
  color text,
  talla text,
  cantidad int,
  extra jsonb not null default '{}'::jsonb,
  necesita_aclaracion boolean not null default false,
  temperatura text not null,
  score int not null,
  razon text,
  derivar boolean not null default false,
  estado text not null default 'nuevo'
);

-- Lectura pública para el dashboard (anon, solo SELECT)
alter table public.pedidos enable row level security;

create policy "lectura publica pedidos"
  on public.pedidos for select
  to anon
  using (true);
