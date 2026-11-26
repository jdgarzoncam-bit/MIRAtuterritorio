-- MIRA TU TERRITORIO
-- QA migration: retrieve attendance and linked person details in one authorized query.
CREATE OR REPLACE FUNCTION mira.list_activity_attendance_details(
  p_activity_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  attendance_id uuid, person_id uuid, activity_id uuid, fecha_registro timestamptz,
  attendance_status text, cancellation_reason text, cedula text, nombres text,
  apellidos text, telefono text, info_mira boolean, tiene_app_infomira boolean,
  tipo_participacion text, actividad_nombre text, actividad_fecha date, actividad_lugar text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'mira', 'auth'
AS $function$
BEGIN
  IF NOT mira.has_module_permission('actividades', 'view') THEN
    RAISE EXCEPTION USING errcode='42501', message='No tienes permiso de Consulta en Actividades.';
  END IF;
  RETURN QUERY
  SELECT a.id,a.persona_id,a.actividad_id,a.fecha_registro,a.estado,a.motivo_anulacion,
         p.cedula,p.nombres,p.apellidos,p.telefono,p.info_mira,p.tiene_app_infomira,
         p.tipo_participacion,act.nombre,act.fecha,act.lugar
  FROM mira.asistencias a
  LEFT JOIN mira.personas p ON p.id=a.persona_id
  LEFT JOIN mira.actividades act ON act.id=a.actividad_id
  WHERE p_activity_id IS NULL OR a.actividad_id=p_activity_id
  ORDER BY a.fecha_registro DESC,a.id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),100)
  OFFSET GREATEST(COALESCE(p_offset,0),0);
END
$function$;
REVOKE ALL ON FUNCTION mira.list_activity_attendance_details(uuid,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION mira.list_activity_attendance_details(uuid,integer,integer) FROM anonymous;
GRANT EXECUTE ON FUNCTION mira.list_activity_attendance_details(uuid,integer,integer) TO authenticated;
