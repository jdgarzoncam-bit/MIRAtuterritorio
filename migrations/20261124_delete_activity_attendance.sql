-- MIRA TU TERRITORIO
-- Eliminar registros de asistencia en lugar de marcarlos como anulados.
-- La eliminación sigue protegida por el permiso histórico actividades.annul.
-- Los triggers central_audit_asistencias y trg_audit_asistencia_changes conservan auditoría.

CREATE OR REPLACE FUNCTION mira.delete_attendance(p_attendance_id uuid)
RETURNS SETOF mira.asistencias
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'mira', 'auth'
AS $function$
DECLARE
  v_deleted mira.asistencias%rowtype;
BEGIN
  IF auth.user_id() IS NULL THEN
    RAISE EXCEPTION USING errcode='42501', message='Se requiere una sesión autenticada.';
  END IF;
  IF NOT mira.has_module_permission('actividades','annul') THEN
    RAISE EXCEPTION USING errcode='42501', message='No tienes permiso para eliminar registros de asistencia.';
  END IF;

  DELETE FROM mira.asistencias
   WHERE id=p_attendance_id
   RETURNING * INTO v_deleted;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode='P0002', message='El registro de asistencia no existe o ya fue eliminado.';
  END IF;
  RETURN NEXT v_deleted;
END
$function$;

-- Compatibilidad con clientes antiguos: la acción anterior "Anular" también
-- ejecuta una eliminación permanente; la interfaz nueva ya no solicita motivo.
CREATE OR REPLACE FUNCTION mira.annul_attendance(p_attendance_id uuid, p_reason text)
RETURNS SETOF mira.asistencias
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'mira', 'auth'
AS $function$
DECLARE
  v_deleted mira.asistencias%rowtype;
BEGIN
  IF auth.user_id() IS NULL THEN
    RAISE EXCEPTION USING errcode='42501', message='Se requiere una sesión autenticada.';
  END IF;
  IF NOT mira.has_module_permission('actividades','annul') THEN
    RAISE EXCEPTION USING errcode='42501', message='No tienes permiso para eliminar registros de asistencia.';
  END IF;

  DELETE FROM mira.asistencias
   WHERE id=p_attendance_id
   RETURNING * INTO v_deleted;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode='P0002', message='El registro de asistencia no existe o ya fue eliminado.';
  END IF;
  RETURN NEXT v_deleted;
END
$function$;

REVOKE ALL ON FUNCTION mira.delete_attendance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mira.delete_attendance(uuid) TO authenticated;
REVOKE ALL ON FUNCTION mira.annul_attendance(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mira.annul_attendance(uuid,text) TO authenticated;

COMMENT ON FUNCTION mira.delete_attendance(uuid) IS
'Elimina una asistencia de forma permanente. Requiere permiso actividades.annul; los triggers de auditoría registran la eliminación.';
NOTIFY pgrst, 'reload schema';
