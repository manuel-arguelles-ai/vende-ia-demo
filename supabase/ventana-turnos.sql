-- Ventana de turnos textuales del bot, configurable por inquilino desde el
-- super-admin. NULL = usar el default del código (20). Clamp 6–60 en la app.
alter table tenants add column if not exists ventana_turnos int;
