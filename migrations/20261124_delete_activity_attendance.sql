-- MIRA TU TERRITORIO
-- Eliminar registros de asistencia en lugar de marcarlos como anulados.
-- La acción sigue protegida por el permiso histórico actividades.annul.
-- La eliminación queda registrada en admin_audit_log y, cuando existen,
-- en los triggers/tablas específicos de auditoría de asistencia.

-- Producción aún no reconocía el permiso "annul" en has_module_permission.
-- Se añade dinámicamente sin reemplazar el resto de reglas de seguridad
-- específicas que tenga cada rama (QA y producción).
DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('mira.has_module_permission(text,text)'::regprocedure)
    INTO v_definition;
  IF position('''annul''' IN v_definition)=0 THEN
    v_definition := replace(
      v_definition,
      '''delete'',''export'',''manage'') THEN false',
      '''delete'',''export'',''manage'',''annul'') THEN false'
    );
    IF position('''annul''' IN v_definition)=0 THEN
      RAISE EXCEPTION 'No fue posible habilitar el permiso actividades.annul sin alterar otras reglas.';
    END IF;
    EXECUTE v_definition;
  END IF;
END
$migration$;

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

  INSERT INTO mira.admin_audit_log(actor_auth_user_id,action_key,details)
  VALUES(
    auth.user_id()::text,
    'attendance_deleted',
    jsonb_build_object(
      'attendance_id',v_deleted.id,
      'activity_id',v_deleted.actividad_id,
      'person_id',v_deleted.persona_id,
      'registered_at',v_deleted.fecha_registro
    )
  );
  RETURN NEXT v_deleted;
END
$function$;

-- Compatibilidad con clientes antiguos: la acción anterior "Anular"
-- también ejecuta una eliminación permanente.
CREATE OR REPLACE FUNCTION mira.annul_attendance(p_attendance_id uuid, p_reason text)
RETURNS SETOF mira.asistencias
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'mira', 'auth'
AS $function$
BEGIN
  RETURN QUERY SELECT * FROM mira.delete_attendance(p_attendance_id);
END
$function$;

REVOKE ALL ON FUNCTION mira.delete_attendance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mira.delete_attendance(uuid) TO authenticated;
REVOKE ALL ON FUNCTION mira.annul_attendance(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mira.annul_attendance(uuid,text) TO authenticated;

COMMENT ON FUNCTION mira.delete_attendance(uuid) IS
'Elimina una asistencia de forma permanente. Requiere permiso actividades.annul y registra la eliminación en admin_audit_log.';
NOTIFY pgrst, 'reload schema';
