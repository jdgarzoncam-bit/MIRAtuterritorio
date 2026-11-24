-- MIRA TU TERRITORIO · QA
-- Autoriza el RPC de registro para sesiones Neon autenticadas que también
-- han superado el PIN de equipo; la validación del token permanece dentro
-- de las funciones SECURITY DEFINER.
GRANT EXECUTE ON FUNCTION mira.public_register_activity_participant(text, text, text, text, uuid, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION mira.public_check_activity_participant(
  p_cedula text,
  p_actividad_id uuid,
  p_access_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, mira, auth
AS $function$
DECLARE
  v_actor text := coalesce(auth.uid()::text, auth.user_id(), 'anonymous');
  v_cedula text;
  v_persona_id uuid;
  v_attendance record;
  v_already_registered boolean := false;
BEGIN
  IF p_access_token IS NULL OR NOT EXISTS (
    SELECT 1 FROM mira.participant_access_sessions s
    WHERE s.token = p_access_token
      AND s.actor_uid = v_actor
      AND s.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'La autorización venció o no es válida. Ingresa nuevamente el PIN.';
  END IF;

  IF p_actividad_id IS NULL THEN
    RAISE EXCEPTION 'Selecciona una actividad antes de consultar la inscripción.';
  END IF;

  v_cedula := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g');
  IF length(v_cedula) < 5 OR length(v_cedula) > 15 THEN
    RAISE EXCEPTION 'La cédula debe contener entre 5 y 15 dígitos.';
  END IF;

  SELECT p.id INTO v_persona_id
  FROM mira.personas p
  WHERE p.cedula_normalizada = v_cedula
  LIMIT 1;

  IF v_persona_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'ok', 'person_found', false,
      'already_registered', false, 'attendance_status', null,
      'attendance_id', null, 'registered_at', null
    );
  END IF;

  SELECT a.id, a.estado, a.fecha_registro
  INTO v_attendance
  FROM mira.asistencias a
  WHERE a.persona_id = v_persona_id
    AND a.actividad_id = p_actividad_id
  LIMIT 1;

  v_already_registered := FOUND;

  RETURN jsonb_build_object(
    'status', 'ok',
    'person_found', true,
    'already_registered', v_already_registered,
    'attendance_status', v_attendance.estado,
    'attendance_id', v_attendance.id,
    'registered_at', v_attendance.fecha_registro
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION mira.public_check_activity_participant(text, uuid, uuid)
  TO anonymous, authenticated;

NOTIFY pgrst, 'reload schema';
