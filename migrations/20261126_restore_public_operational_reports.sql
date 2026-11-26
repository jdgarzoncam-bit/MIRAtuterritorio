-- MIRA TU TERRITORIO
-- Restore the operational public-report intake that is still used by reporte-publico.js.
-- The public endpoint is INSERT-only: no anonymous read, update or delete.
CREATE TABLE IF NOT EXISTS mira.reportes_operativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  puesto_votacion text NOT NULL,
  mesa_votacion text NOT NULL,
  tipo_reporte text NOT NULL CHECK (tipo_reporte IN ('novedad','acta','logistica','otro')),
  descripcion text NOT NULL,
  estado text NOT NULL DEFAULT 'recibido' CHECK (estado IN ('recibido','en_revision','cerrado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mira.reportes_operativos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mira.reportes_operativos FROM PUBLIC, anonymous, authenticated;
GRANT INSERT ON TABLE mira.reportes_operativos TO anonymous;

DROP POLICY IF EXISTS reportes_operativos_public_insert ON mira.reportes_operativos;
CREATE POLICY reportes_operativos_public_insert
ON mira.reportes_operativos
FOR INSERT TO anonymous
WITH CHECK (
  auth.user_id() IS NOT NULL
  AND length(btrim(puesto_votacion)) BETWEEN 2 AND 160
  AND length(btrim(mesa_votacion)) BETWEEN 1 AND 40
  AND tipo_reporte IN ('novedad','acta','logistica','otro')
  AND length(btrim(descripcion)) BETWEEN 5 AND 1500
  AND estado = 'recibido'
);

INSERT INTO mira.module_catalog(module_key,module_name,description,active,sort_order)
VALUES('reportes','Reportes operativos','Recepción pública de novedades de jornada electoral',true,90)
ON CONFLICT(module_key) DO UPDATE
SET module_name=EXCLUDED.module_name,
    description=EXCLUDED.description,
    active=true;
