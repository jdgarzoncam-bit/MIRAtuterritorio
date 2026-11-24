-- MIRA TU TERRITORIO · QA
-- Corrección del doble PIN: el UUID aleatorio temporal es una credencial bearer.
-- La identidad Neon puede cambiar entre la portada y el portal sin invalidar la autorización.
-- No crear un RPC nuevo: Neon Data API ya tiene en caché la firma estable
-- public_register_activity_participant(text,text,text,text,uuid,boolean).
-- La consulta previa usa un marcador interno protegido por PIN dentro de esa firma.
CREATE OR REPLACE FUNCTION mira.public_register_activity_participant(p_cedula text, p_nombres text, p_apellidos text, p_telefono text, p_actividad_id uuid, p_consentimiento boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'mira', 'auth'
AS $function$
DECLARE
  v_actor text := coalesce(auth.uid()::text,auth.user_id(),'anonymous');
  v_config mira.participant_access_pin_config%ROWTYPE;
  v_attempts integer; v_locked_until timestamptz; v_token uuid;
  v_payload jsonb; v_cedula text; v_persona_id uuid; v_telefono text;
  v_info_mira boolean; v_tiene_app_infomira boolean; v_tipo_participacion text; v_access_token uuid; v_person jsonb; v_activity_id uuid; v_attendance_id mira.asistencias.id%TYPE; v_attendance_status mira.asistencias.estado%TYPE; v_registered_at mira.asistencias.fecha_registro%TYPE; v_already_registered boolean := false;
BEGIN
  IF p_cedula='__MIRA_PIN_VERIFY__' THEN
    SELECT * INTO v_config FROM mira.participant_access_pin_config WHERE id=1 AND enabled=true;
    IF NOT FOUND THEN RAISE EXCEPTION 'El acceso al registro no está configurado.'; END IF;
    SELECT attempts,locked_until INTO v_attempts,v_locked_until FROM mira.participant_access_attempts WHERE actor_uid=v_actor FOR UPDATE;
    IF v_locked_until IS NOT NULL AND v_locked_until>now() THEN RAISE EXCEPTION 'Demasiados intentos. Espera 15 minutos antes de intentar nuevamente.'; END IF;
    IF lower(coalesce(p_nombres,'')) IS DISTINCT FROM lower(v_config.pin_verifier_hex) THEN
      INSERT INTO mira.participant_access_attempts(actor_uid,attempts,window_started_at,locked_until) VALUES(v_actor,1,now(),NULL)
      ON CONFLICT(actor_uid) DO UPDATE SET
        attempts=CASE WHEN mira.participant_access_attempts.window_started_at < now()-interval '15 minutes' THEN 1 ELSE mira.participant_access_attempts.attempts+1 END,
        window_started_at=CASE WHEN mira.participant_access_attempts.window_started_at < now()-interval '15 minutes' THEN now() ELSE mira.participant_access_attempts.window_started_at END,
        locked_until=CASE WHEN (CASE WHEN mira.participant_access_attempts.window_started_at < now()-interval '15 minutes' THEN 1 ELSE mira.participant_access_attempts.attempts+1 END)>=5 THEN now()+interval '15 minutes' ELSE NULL END
      RETURNING attempts,locked_until INTO v_attempts,v_locked_until;
      IF v_locked_until IS NOT NULL AND v_locked_until>now() THEN RAISE EXCEPTION 'PIN incorrecto. Se alcanzó el límite de intentos; espera 15 minutos.'; END IF;
      RAISE EXCEPTION 'El código de acceso no es correcto.';
    END IF;
    INSERT INTO mira.participant_access_attempts(actor_uid,attempts,window_started_at,locked_until) VALUES(v_actor,0,now(),NULL)
    ON CONFLICT(actor_uid) DO UPDATE SET attempts=0,window_started_at=now(),locked_until=NULL;
    DELETE FROM mira.participant_access_sessions WHERE expires_at<now();
    INSERT INTO mira.participant_access_sessions(actor_uid,expires_at) VALUES(v_actor,now()+interval '45 minutes') RETURNING token INTO v_token;
    RETURN jsonb_build_object('status','ok','access_token',v_token,'expires_in',2700);
  END IF;

  IF p_cedula='__MIRA_ACTIVITY_CHECK__' THEN
    BEGIN v_access_token:=p_apellidos::uuid;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'La autorización venció. Ingresa nuevamente el PIN.'; END;
    BEGIN v_activity_id:=p_telefono::uuid;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'Selecciona una actividad válida antes de consultar la inscripción.'; END;
    IF NOT EXISTS(SELECT 1 FROM mira.participant_access_sessions s WHERE s.token=v_access_token AND s.expires_at>now())
      THEN RAISE EXCEPTION 'La autorización venció o no es válida. Ingresa nuevamente el PIN.'; END IF;
    IF NOT EXISTS(SELECT 1 FROM mira.actividades a WHERE a.id=v_activity_id AND lower(trim(a.estado)) IN ('activa','active','en_curso'))
      THEN RAISE EXCEPTION 'Esta actividad ya no está disponible para inscripción.'; END IF;
    v_cedula:=regexp_replace(coalesce(p_nombres,''),'[^0-9]','','g');
    IF length(v_cedula)<5 OR length(v_cedula)>15 THEN RAISE EXCEPTION 'La cédula debe contener entre 5 y 15 dígitos.'; END IF;
    SELECT p.id,jsonb_build_object('id',p.id,'cedula',p.cedula,'nombres',p.nombres,'apellidos',p.apellidos,
      'telefono',p.telefono,'correo',p.correo,'info_mira',p.info_mira,'tiene_app_infomira',p.tiene_app_infomira,
      'puesto_votacion',p.puesto_votacion,'mesa_votacion',p.mesa_votacion,'requiere_transporte',p.requiere_transporte,
      'edad',p.edad,'tipo_participacion',p.tipo_participacion,'barrio',p.barrio,'activo',p.activo,
      'inactivo',p.inactivo,'datos_pendientes',p.datos_pendientes)
    INTO v_persona_id,v_person FROM mira.personas p
    WHERE p.cedula_normalizada=v_cedula LIMIT 1;
    IF v_persona_id IS NOT NULL THEN
      SELECT a.id,a.estado,a.fecha_registro INTO v_attendance_id,v_attendance_status,v_registered_at
      FROM mira.asistencias a
      WHERE a.persona_id=v_persona_id AND a.actividad_id=v_activity_id
      LIMIT 1;
      v_already_registered:=FOUND;
    END IF;
    RETURN jsonb_build_object('status','ok','person_found',v_persona_id IS NOT NULL,'person',v_person,
      'already_registered',v_already_registered,'attendance_status',v_attendance_status,
      'attendance_id',v_attendance_id,'registered_at',v_registered_at);
  END IF;

  IF p_cedula='__MIRA_PIN_LOOKUP__' THEN
    BEGIN v_access_token:=p_apellidos::uuid;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'La autorización venció. Ingresa nuevamente el PIN.'; END;
    IF NOT EXISTS(SELECT 1 FROM mira.participant_access_sessions s WHERE s.token=v_access_token AND s.expires_at>now())
      THEN RAISE EXCEPTION 'La autorización venció o no es válida. Ingresa nuevamente el PIN.'; END IF;
    v_cedula:=regexp_replace(coalesce(p_nombres,''),'[^0-9]','','g');
    IF length(v_cedula)<5 OR length(v_cedula)>15 THEN RAISE EXCEPTION 'La cédula debe contener entre 5 y 15 dígitos.'; END IF;
    SELECT jsonb_build_object('id',p.id,'cedula',p.cedula,'nombres',p.nombres,'apellidos',p.apellidos,
      'telefono',p.telefono,'correo',p.correo,'info_mira',p.info_mira,'tiene_app_infomira',p.tiene_app_infomira,'puesto_votacion',p.puesto_votacion,
      'mesa_votacion',p.mesa_votacion,'requiere_transporte',p.requiere_transporte,'edad',p.edad,
      'tipo_participacion',p.tipo_participacion,'barrio',p.barrio,'activo',p.activo,'inactivo',p.inactivo,
      'datos_pendientes',p.datos_pendientes)
    INTO v_person FROM mira.personas p WHERE p.cedula_normalizada=v_cedula LIMIT 1;
    RETURN v_person;
  END IF;

  BEGIN v_payload:=p_telefono::jsonb; EXCEPTION WHEN others THEN v_payload:='{}'::jsonb; END;
  BEGIN v_access_token:=(v_payload->>'access_token')::uuid; EXCEPTION WHEN others THEN v_access_token:=NULL; END;
  IF v_access_token IS NULL OR NOT EXISTS(SELECT 1 FROM mira.participant_access_sessions s WHERE s.token=v_access_token AND s.expires_at>now())
    THEN RAISE EXCEPTION 'La autorización venció o no es válida. Ingresa nuevamente el PIN.'; END IF;
  v_cedula:=regexp_replace(coalesce(p_cedula,''),'[^0-9]','','g');
  IF length(v_cedula)<5 OR length(v_cedula)>15 THEN RAISE EXCEPTION 'La cédula debe contener entre 5 y 15 dígitos.'; END IF;
  IF length(trim(coalesce(p_nombres,'')))<2 OR length(trim(coalesce(p_apellidos,'')))<2 THEN RAISE EXCEPTION 'Escribe nombres y apellidos completos.'; END IF;
  IF p_consentimiento IS DISTINCT FROM true THEN RAISE EXCEPTION 'Debes aceptar el tratamiento de datos para continuar.'; END IF;
  v_telefono:=nullif(trim(coalesce(v_payload->>'telefono','')),'');
  v_info_mira:=CASE WHEN v_payload ? 'info_mira' THEN (v_payload->>'info_mira')::boolean ELSE NULL END;
  v_tiene_app_infomira:=CASE WHEN v_payload ? 'tiene_app_infomira' THEN (v_payload->>'tiene_app_infomira')::boolean ELSE NULL END;
  v_tipo_participacion:=nullif(v_payload->>'tipo_participacion','');
  IF v_info_mira IS NULL OR v_tiene_app_infomira IS NULL OR v_tipo_participacion NOT IN ('interno','externo') THEN RAISE EXCEPTION 'Indica si está inscrito a InfoMIRA, si tiene la App InfoMIRA y el tipo de participante.'; END IF;
  IF p_actividad_id IS NULL OR NOT EXISTS(SELECT 1 FROM mira.actividades a WHERE a.id=p_actividad_id AND lower(trim(a.estado)) IN ('activa','active','en_curso'))
    THEN RAISE EXCEPTION 'Esta actividad ya no está disponible para inscripción.'; END IF;
  SELECT p.id INTO v_persona_id FROM mira.personas p WHERE p.cedula_normalizada=v_cedula LIMIT 1;
  IF v_persona_id IS NULL THEN
    INSERT INTO mira.personas(cedula,nombres,apellidos,telefono,info_mira,tiene_app_infomira,tipo_participacion,activo,inactivo,datos_pendientes,fuente_registro,creado_por)
    VALUES(v_cedula,trim(p_nombres),trim(p_apellidos),v_telefono,v_info_mira,v_tiene_app_infomira,v_tipo_participacion,true,false,(v_telefono IS NULL),'registro_publico_actividades','registro_publico_actividades')
    ON CONFLICT(cedula_normalizada) DO NOTHING RETURNING id INTO v_persona_id;
    IF v_persona_id IS NULL THEN SELECT p.id INTO v_persona_id FROM mira.personas p WHERE p.cedula_normalizada=v_cedula LIMIT 1; END IF;
  ELSE
    UPDATE mira.personas SET info_mira=coalesce(info_mira,v_info_mira),tiene_app_infomira=coalesce(v_tiene_app_infomira,tiene_app_infomira),tipo_participacion=coalesce(tipo_participacion,v_tipo_participacion),
      telefono=coalesce(telefono,v_telefono),updated_at=now() WHERE id=v_persona_id;
  END IF;
  IF v_persona_id IS NULL THEN RAISE EXCEPTION 'No fue posible crear o validar la ficha de la persona.'; END IF;
  IF EXISTS(SELECT 1 FROM mira.personas p WHERE p.id=v_persona_id AND (p.activo=false OR p.inactivo=true))
    THEN RAISE EXCEPTION 'Esta ficha requiere revisión administrativa. No se registró la asistencia.'; END IF;
  INSERT INTO mira.asistencias(persona_id,actividad_id,registrado_por,observaciones)
  VALUES(v_persona_id,p_actividad_id,'registro_publico_autorizado','Consentimiento aceptado mediante PIN: '||to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  RETURN jsonb_build_object('status','ok','message','Registro completado correctamente.');
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('status','duplicate','message','Esta cédula ya tiene asistencia registrada en la actividad seleccionada.');
END
$function$


CREATE OR REPLACE FUNCTION mira.public_check_activity_participant(p_cedula text, p_actividad_id uuid, p_access_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'mira', 'auth'
AS $function$
DECLARE
  v_cedula text;
  v_persona_id uuid;
  v_attendance_id mira.asistencias.id%TYPE;
  v_attendance_status mira.asistencias.estado%TYPE;
  v_registered_at mira.asistencias.fecha_registro%TYPE;
  v_already_registered boolean := false;
BEGIN
  IF p_access_token IS NULL OR NOT EXISTS (
    SELECT 1 FROM mira.participant_access_sessions s
    WHERE s.token = p_access_token AND s.expires_at > now()
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
  WHERE a.persona_id = v_persona_id AND a.actividad_id = p_actividad_id LIMIT 1;
  v_already_registered := FOUND;
  RETURN jsonb_build_object('status','ok','person_found',true,'already_registered',v_already_registered,
    'attendance_status',v_attendance_status,'attendance_id',v_attendance_id,'registered_at',v_registered_at);
END;
$function$;


GRANT EXECUTE ON FUNCTION mira.public_register_activity_participant(text,text,text,text,uuid,boolean) TO anonymous, authenticated;
NOTIFY pgrst, 'reload schema';
