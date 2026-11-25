-- MIRA TU TERRITORIO · QA
-- Alinea las RPC públicas de consulta con el token temporal emitido por el PIN.
-- No modifica personas, actividades ni asistencias.
CREATE OR REPLACE FUNCTION mira.public_lookup_participant(p_cedula text, p_access_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'mira', 'auth'
AS $function$
DECLARE
  v_actor text := coalesce(auth.uid()::text, auth.user_id(), 'anonymous');
  v_person jsonb;
  v_cedula text := regexp_replace(coalesce(p_cedula,''),'[^0-9]','','g');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM mira.participant_access_sessions s
    WHERE s.token=p_access_token AND s.actor_uid=v_actor AND s.expires_at>now()
  ) THEN RAISE EXCEPTION 'La autorización venció o no es válida. Ingresa nuevamente el PIN.'; END IF;
  IF length(v_cedula)<5 OR length(v_cedula)>15 THEN RAISE EXCEPTION 'La cédula debe contener entre 5 y 15 dígitos.'; END IF;
  SELECT jsonb_build_object(
    'id',p.id,'cedula',p.cedula,'nombres',p.nombres,'apellidos',p.apellidos,
    'telefono',p.telefono,'correo',p.correo,'info_mira',p.info_mira,
    'tiene_app_infomira',p.tiene_app_infomira,
    'puesto_votacion',p.puesto_votacion,'mesa_votacion',p.mesa_votacion,
    'requiere_transporte',p.requiere_transporte,'edad',p.edad,
    'tipo_participacion',p.tipo_participacion,'barrio',p.barrio,
    'activo',p.activo,'inactivo',p.inactivo,'datos_pendientes',p.datos_pendientes
  ) INTO v_person
  FROM mira.personas p WHERE p.cedula_normalizada=v_cedula LIMIT 1;
  RETURN v_person;
END
$function$;

CREATE OR REPLACE FUNCTION mira.public_check_activity_participant(p_cedula text, p_actividad_id uuid, p_access_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'mira', 'auth'
AS $function$
DECLARE
  v_actor text := coalesce(auth.uid()::text, auth.user_id(), 'anonymous');
  v_cedula text;
  v_persona_id uuid;
  v_attendance_id mira.asistencias.id%TYPE;
  v_attendance_status mira.asistencias.estado%TYPE;
  v_registered_at mira.asistencias.fecha_registro%TYPE;
  v_already_registered boolean := false;
BEGIN
  IF p_access_token IS NULL OR NOT EXISTS (
    SELECT 1 FROM mira.participant_access_sessions s
    WHERE s.token=p_access_token AND s.actor_uid=v_actor AND s.expires_at>now()
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
  SELECT p.id INTO v_persona_id FROM mira.personas p
  WHERE p.cedula_normalizada = v_cedula LIMIT 1;
  IF v_persona_id IS NULL THEN
    RETURN jsonb_build_object('status','ok','person_found',false,'already_registered',false,
      'attendance_status',null,'attendance_id',null,'registered_at',null);
  END IF;
  SELECT a.id, a.estado, a.fecha_registro INTO v_attendance_id,v_attendance_status,v_registered_at
  FROM mira.asistencias a
  WHERE a.persona_id=v_persona_id AND a.actividad_id=p_actividad_id LIMIT 1;
  v_already_registered := FOUND;
  RETURN jsonb_build_object('status','ok','person_found',true,'already_registered',v_already_registered,
    'attendance_status',v_attendance_status,'attendance_id',v_attendance_id,'registered_at',v_registered_at);
END
$function$;
