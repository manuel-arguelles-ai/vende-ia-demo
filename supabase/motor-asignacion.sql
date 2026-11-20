alter table usuarios add column if not exists peso int not null default 1;
alter table usuarios add column if not exists limite_activos int;
