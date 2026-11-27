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

DROP POLICY IF EXISTS pqrs_submit_authenticated ON mira.pqrs;
CREATE POLICY pqrs_submit_authenticated
ON mira.pqrs
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.user_id()
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
  AND EXISTS (
    SELECT 1 FROM mira.user_profiles u
    WHERE u.auth_user_id = auth.user_id()
      AND u.active = true
      AND u.email_verified = true
  )
);

DELETE FROM mira.module_permissions WHERE module_key = 'logistica';

CREATE OR REPLACE FUNCTION mira.public_register_activity_participant(p_cedula text, p_nombres text, p_apellidos text, p_telefono text, p_actividad_id uuid, p_consentimiento boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'mira', 'auth'
AS $function$
DECLARE
 v_actor text := coalesce(auth.uid()::text,auth.user_id(),'anonymous');
 v_payload jsonb;
 v_access_token uuid;
 v_cedula text;
 v_persona_id uuid;
 v_telefono text;
 v_info_mira boolean;
 v_tiene_app_infomira boolean;
 v_tipo_participacion text;
BEGIN
 BEGIN
  v_payload := coalesce(nullif(trim(p_telefono),''),'{}')::jsonb;
 EXCEPTION WHEN others THEN v_payload := '{}'::jsonb;
 END;
 BEGIN
  v_access_token := (v_payload->>'access_token')::uuid;
 EXCEPTION WHEN others THEN v_access_token := NULL;
 END;
 IF v_access_token IS NULL OR NOT EXISTS (
  SELECT 1 FROM mira.participant_access_sessions s
  WHERE s.token=v_access_token AND s.actor_uid=v_actor AND s.expires_at>now()
 ) THEN RAISE EXCEPTION 'La autorización venció o no es válida. Ingresa nuevamente el PIN.'; END IF;
 v_cedula := regexp_replace(coalesce(p_cedula,''),'[^0-9]','','g');
 IF length(v_cedula)<5 OR length(v_cedula)>15 THEN RAISE EXCEPTION 'La cédula debe contener entre 5 y 15 dígitos.'; END IF;
 IF length(trim(coalesce(p_nombres,'')))<2 OR length(trim(coalesce(p_apellidos,'')))<2 THEN RAISE EXCEPTION 'Escribe nombres y apellidos completos.'; END IF;
 IF p_consentimiento IS DISTINCT FROM true THEN RAISE EXCEPTION 'Debes aceptar el tratamiento de datos para continuar.'; END IF;
 v_telefono := nullif(trim(coalesce(v_payload->>'telefono','')),'');
 v_info_mira := CASE WHEN v_payload ? 'info_mira' THEN (v_payload->>'info_mira')::boolean ELSE NULL END;
 v_tiene_app_infomira := CASE WHEN v_payload ? 'tiene_app_infomira' THEN (v_payload->>'tiene_app_infomira')::boolean ELSE NULL END;
 v_tipo_participacion := nullif(v_payload->>'tipo_participacion','');
 IF v_info_mira IS NULL OR v_tiene_app_infomira IS NULL OR v_tipo_participacion IS NULL OR v_tipo_participacion NOT IN ('interno','externo') THEN
  RAISE EXCEPTION 'Indica si está inscrito a InfoMIRA, si tiene la App InfoMIRA y el tipo de participante.';
 END IF;
 IF p_actividad_id IS NULL OR NOT EXISTS (SELECT 1 FROM mira.actividades a WHERE a.id=p_actividad_id AND lower(trim(a.estado)) IN ('activa','active','en_curso')) THEN
  RAISE EXCEPTION 'Esta actividad ya no está disponible para inscripción.';
 END IF;
 SELECT p.id INTO v_persona_id FROM mira.personas p WHERE p.cedula_normalizada=v_cedula LIMIT 1;
 IF v_persona_id IS NULL THEN
  INSERT INTO mira.personas(cedula,nombres,apellidos,telefono,info_mira,tiene_app_infomira,tipo_participacion,activo,inactivo,datos_pendientes,fuente_registro,creado_por)
  VALUES(v_cedula,trim(p_nombres),trim(p_apellidos),v_telefono,v_info_mira,v_tiene_app_infomira,v_tipo_participacion,true,false,(v_telefono IS NULL),'registro_publico_actividades','registro_publico_actividades')
  ON CONFLICT(cedula_normalizada) DO NOTHING RETURNING id INTO v_persona_id;
  IF v_persona_id IS NULL THEN SELECT p.id INTO v_persona_id FROM mira.personas p WHERE p.cedula_normalizada=v_cedula LIMIT 1; END IF;
 ELSE
  UPDATE mira.personas SET nombres=trim(p_nombres),apellidos=trim(p_apellidos),telefono=v_telefono,info_mira=v_info_mira,tiene_app_infomira=v_tiene_app_infomira,tipo_participacion=v_tipo_participacion,updated_at=now()
  WHERE id=v_persona_id;
 END IF;
 IF v_persona_id IS NULL THEN RAISE EXCEPTION 'No fue posible crear o validar la ficha de la persona.'; END IF;
 UPDATE mira.personas p SET info_mira=false,updated_at=now() WHERE p.id=v_persona_id AND (p.activo=false OR p.inactivo=true);
 INSERT INTO mira.asistencias(persona_id,actividad_id,registrado_por,observaciones)
 VALUES(v_persona_id,p_actividad_id,'registro_publico_autorizado','Consentimiento aceptado mediante PIN: '||to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'));
 RETURN jsonb_build_object('status','ok','message','Registro completado correctamente.');
EXCEPTION WHEN unique_violation THEN
 RETURN jsonb_build_object('status','duplicate','message','Esta cédula ya tiene asistencia registrada en la actividad seleccionada.');
END
$function$;

REVOKE ALL ON FUNCTION mira.public_register_activity_participant(text,text,text,text,uuid,boolean) FROM PUBLIC, anonymous, authenticated;
DELETE FROM mira.module_catalog WHERE module_key = 'logistica';

COMMIT;
