-- Ventas/Reservas: el cierre gana tipo (venta|reserva), tienda de recojo, y un
-- estado intermedio 'reservada' (libro apartado, aún no pagado/recogido).
alter table cierres add column if not exists tipo text;       -- 'venta' | 'reserva' | null (legacy)
alter table cierres add column if not exists tienda_id bigint references tiendas(id);

alter table cierres drop constraint if exists cierres_estado_check;
alter table cierres add constraint cierres_estado_check
  check (estado in ('ganado','perdido','reabierto','reservada'));
