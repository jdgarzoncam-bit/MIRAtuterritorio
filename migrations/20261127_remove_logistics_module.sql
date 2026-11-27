-- MIRA TU TERRITORIO
-- Retire the obsolete Logistica module from both QA and production.
-- No operational table or PQRS records are deleted.
-- The module has no remaining permissions, data tables, or routines.
-- Keep the PQRS channel but reject the retired module key.
BEGIN;

DROP POLICY IF EXISTS pqrs_public_submit_anonymous ON mira.pqrs;
CREATE POLICY pqrs_public_submit_anonymous
ON mira.pqrs
FOR INSERT
TO anonymous
WITH CHECK (
  created_by = auth.user_id()
  AND tipo = ANY (ARRAY['peticion'::text, 'queja'::text, 'reclamo'::text, 'sugerencia'::text])
  AND modulo_key = ANY (ARRAY[
    'infomira'::text,
    'testigos'::text,
    'info_electoral'::text,
    'barrios_puestos'::text,
    'actividades'::text,
    'concejal'::text,
    'centro_operaciones'::text,
    'pqrs'::text,
    'otro'::text
  ])
  AND length(btrim(asunto)) BETWEEN 4 AND 160
  AND length(btrim(descripcion)) BETWEEN 10 AND 5000
  AND estado = 'recibida'::text
);

DELETE FROM mira.module_permissions WHERE module_key = 'logistica';
DELETE FROM mira.module_catalog WHERE module_key = 'logistica';

COMMIT;
