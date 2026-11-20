-- Personalización del agente por inquilino. Aditivo (columnas nullable / con default).
alter table agente_perfil add column if not exists negocio_nombre text;
alter table agente_perfil add column if not exists rubro text;
alter table agente_perfil add column if not exists categorias text;
alter table agente_perfil add column if not exists saludo_inicial text;
alter table agente_perfil add column if not exists mensaje_no_se text;
alter table agente_perfil add column if not exists temas_prohibidos text;
alter table agente_perfil add column if not exists emojis boolean not null default true;
alter table agente_perfil add column if not exists longitud text not null default 'cortas';
alter table agente_perfil add column if not exists intensidad_cierre text not null default 'cerrador';
alter table agente_perfil add column if not exists agresividad text not null default 'suave';
-- `tono` ya existe (text); pasa a usarse como enum lógico ('cercano'|'neutral'|'formal').
