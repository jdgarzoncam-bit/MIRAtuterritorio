-- Estado de inactividad independiente del archivado.
-- activo=false conserva el significado histórico de registro archivado.
-- inactivo=true identifica personas con marca ❌ en la fuente original InfoMIRA.
ALTER TABLE mira.personas
  ADD COLUMN IF NOT EXISTS inactivo boolean NOT NULL DEFAULT false;

UPDATE mira.personas AS p
SET inactivo = true,
    updated_at = now()
WHERE p.activo = true
  AND EXISTS (
    SELECT 1
    FROM mira.infomira_red AS r
    WHERE r.persona_id = p.id
      AND btrim(coalesce(r.estado_original, '')) = '❌'
  );
