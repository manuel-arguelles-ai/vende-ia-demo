-- Teléfono real del cliente en la alerta (el remitente puede ser un LID opaco).
alter table alertas_fraude add column if not exists telefono text;
