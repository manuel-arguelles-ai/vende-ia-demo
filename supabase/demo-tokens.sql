-- Tokens LLM consumidos por cada chat demo (medido al regenerarlo en vivo por el agente real).
alter table public.contactos add column if not exists demo_tokens int;
-- Desglose de tokens por turno del chat demo (para el detalle expandible en super-admin).
alter table public.contactos add column if not exists demo_turnos jsonb;
alter table public.mensajes add column if not exists imagen_url text;  -- comprobantes/fotos en el chat
