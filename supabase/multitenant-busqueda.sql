-- Búsqueda híbrida multi-tenant del catálogo.
-- Idéntica a busqueda.sql pero filtra por p_tenant_id en los 4 CTE,
-- para aislar resultados por tenant. Aplicar SOLO a staging (su proyecto Supabase de staging).

-- Drop the old 3-arg overload (no tenant_id) that was still granted to anon.
DROP FUNCTION IF EXISTS public.buscar_productos(text, vector, int);

CREATE OR REPLACE FUNCTION public.buscar_productos(
  q text,
  p_tenant_id bigint,
  q_emb vector(768) DEFAULT NULL,
  lim int DEFAULT 5
)
RETURNS TABLE (
  id bigint, seccion text, categoria text, marca text, nombre text,
  precio numeric, presentacion text, stock integer, descripcion text,
  metodos text, puntaje real, sim_vec real
)
LANGUAGE sql STABLE AS $$
WITH qn AS (
  SELECT quitar_acentos(lower(q)) AS qtxt
),
t_and AS (
  SELECT p.id, ts_rank_cd(p.busq, websearch_to_tsquery('spanish', qn.qtxt)) AS r,
         row_number() OVER (ORDER BY ts_rank_cd(p.busq, websearch_to_tsquery('spanish', qn.qtxt)) DESC, p.stock DESC) AS pos
  FROM productos p, qn
  WHERE p.tenant_id = p_tenant_id
    AND qn.qtxt <> '' AND p.busq @@ websearch_to_tsquery('spanish', qn.qtxt)
),
t_or AS (
  SELECT p.id, ts_rank_cd(p.busq, websearch_to_tsquery('spanish', regexp_replace(qn.qtxt, '\s+', ' or ', 'g'))) AS r,
         row_number() OVER (ORDER BY ts_rank_cd(p.busq, websearch_to_tsquery('spanish', regexp_replace(qn.qtxt, '\s+', ' or ', 'g'))) DESC, p.stock DESC) AS pos
  FROM productos p, qn
  WHERE p.tenant_id = p_tenant_id
    AND p.busq @@ websearch_to_tsquery('spanish', regexp_replace(qn.qtxt, '\s+', ' or ', 'g'))
),
t_trgm AS (
  SELECT p.id, word_similarity(qn.qtxt, quitar_acentos(lower(p.nombre || ' ' || coalesce(p.marca,'')))) AS r,
         row_number() OVER (ORDER BY word_similarity(qn.qtxt, quitar_acentos(lower(p.nombre || ' ' || coalesce(p.marca,'')))) DESC) AS pos
  FROM productos p, qn
  WHERE p.tenant_id = p_tenant_id
    AND word_similarity(qn.qtxt, quitar_acentos(lower(p.nombre || ' ' || coalesce(p.marca,'')))) > 0.45
),
t_vec AS (
  SELECT p.id, (1 - (p.embedding <=> q_emb))::real AS r,
         row_number() OVER (ORDER BY p.embedding <=> q_emb) AS pos
  FROM productos p
  WHERE p.tenant_id = p_tenant_id
    AND q_emb IS NOT NULL AND p.embedding IS NOT NULL
  ORDER BY p.embedding <=> q_emb
  LIMIT 20
),
todas AS (
  SELECT id, pos, 3.0 AS w, 'and' AS m, r FROM t_and
  UNION ALL SELECT id, pos, 1.0, 'or', r FROM t_or
  UNION ALL SELECT id, pos, 1.5, 'trgm', r FROM t_trgm
  UNION ALL SELECT id, pos, 2.0, 'vec', r FROM t_vec
),
fusion AS (
  SELECT id,
         sum(w / (10 + pos))::real AS rrf,
         string_agg(DISTINCT m, '+' ORDER BY m) AS metodos,
         max(r) FILTER (WHERE m = 'vec')::real AS sim_vec
  FROM todas GROUP BY id
)
SELECT p.id, p.seccion, p.categoria, p.marca, p.nombre, p.precio, p.presentacion, p.stock,
       nullif(left(coalesce(p.descripcion, ''), 220), '') AS descripcion,
       f.metodos, f.rrf, f.sim_vec
FROM fusion f JOIN productos p ON p.id = f.id
ORDER BY f.rrf DESC, p.stock DESC
LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_productos(text, bigint, vector, int) TO service_role, anon, authenticated;
