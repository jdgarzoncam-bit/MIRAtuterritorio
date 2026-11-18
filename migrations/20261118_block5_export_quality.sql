-- Bloque 5: exportación completa y diagnóstico agregado de calidad.
-- Ejecutar primero en una rama Neon aislada; no modifica registros de negocio.

DROP FUNCTION IF EXISTS mira.export_dataset(text,text,text,text,integer);

CREATE FUNCTION mira.export_dataset(
 p_dataset_key text,
 p_search text DEFAULT '',
 p_filter_field text DEFAULT '',
 p_filter_value text DEFAULT '',
 p_limit integer DEFAULT 100000,
 p_person_status text DEFAULT 'all'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','mira','auth'
AS $function$
DECLARE
 v_table text;
 v_module text;
 v_select text;
 v_search_cols text[];
 v_filter_cols text[];
 v_order_col text := 'created_at';
 v_where text := '';
 v_search_condition text := '';
 v_clause text;
 v_col text;
 v_rows jsonb;
 v_count integer;
 v_total_count bigint;
 v_limit integer := least(greatest(coalesce(p_limit,100000),1),100000);
 v_digits text;
BEGIN
 IF auth.user_id() IS NULL THEN
  RAISE EXCEPTION USING errcode='42501',message='Se requiere una sesión autenticada.';
 END IF;
 CASE p_dataset_key
 WHEN 'personas' THEN
  v_table:='personas'; v_module:='personas';
  v_select:='id,cedula,nombres,apellidos,telefono,correo,barrio,puesto_votacion,mesa_votacion,activo,datos_pendientes,created_at,updated_at';
  v_search_cols:=ARRAY['cedula','nombres','apellidos','barrio'];
  v_filter_cols:=ARRAY['cedula','nombres','apellidos','telefono','correo','barrio','activo','datos_pendientes'];
 WHEN 'actividades' THEN
  v_table:='actividades'; v_module:='actividades';
  v_select:='id,nombre,fecha,lugar,estado,created_at';
  v_search_cols:=ARRAY['nombre','lugar','estado'];
  v_filter_cols:=ARRAY['nombre','fecha','lugar','estado','created_at'];
 WHEN 'asistencias' THEN
  v_table:='asistencias'; v_module:='actividades'; v_order_col:='fecha_registro';
  v_select:='id,persona_id,actividad_id,fecha_registro,estado,motivo_anulacion';
  v_search_cols:=ARRAY['estado','motivo_anulacion'];
  v_filter_cols:=ARRAY['persona_id','actividad_id','fecha_registro','estado','motivo_anulacion'];
 WHEN 'pqrs' THEN
  v_table:='pqrs'; v_module:='pqrs';
  v_select:='id,tipo,modulo_key,asunto,descripcion,estado,created_at,updated_at';
  v_search_cols:=ARRAY['tipo','modulo_key','asunto','descripcion','estado'];
  v_filter_cols:=ARRAY['tipo','modulo_key','asunto','descripcion','estado','created_at'];
 WHEN 'reportes_ciudadanos' THEN
  v_table:='reportes_ciudadanos'; v_module:='concejal';
  v_select:='id,categoria,sector,ubicacion,descripcion,estado,created_at,updated_at';
  v_search_cols:=ARRAY['categoria','sector','ubicacion','descripcion','estado'];
  v_filter_cols:=ARRAY['categoria','sector','ubicacion','descripcion','estado','created_at'];
 WHEN 'concejal_actividades' THEN
  v_table:='concejal_actividades'; v_module:='concejal';
  v_select:='id,barrio,descripcion,fecha,created_at,updated_at';
  v_search_cols:=ARRAY['barrio','descripcion'];
  v_filter_cols:=ARRAY['barrio','descripcion','fecha','created_at'];
 WHEN 'concejal_compromisos' THEN
  v_table:='concejal_compromisos'; v_module:='concejal';
  v_select:='id,barrio,compromiso,adquirido_con,fecha,fecha_limite,estado,resultado,logrado,created_at,updated_at';
  v_search_cols:=ARRAY['barrio','compromiso','adquirido_con','estado','resultado'];
  v_filter_cols:=ARRAY['barrio','compromiso','adquirido_con','fecha','fecha_limite','estado','logrado'];
 WHEN 'infomira_red' THEN
  v_table:='infomira_red'; v_module:='infomira';
  v_select:='id,nombre_original,barrio,estado_original,cuidador_nombre,puesto_votacion,mesa_votacion,movilidad,asistencia,created_at';
  v_search_cols:=ARRAY['nombre_original','barrio','estado_original','cuidador_nombre','puesto_votacion'];
  v_filter_cols:=ARRAY['nombre_original','barrio','estado_original','cuidador_nombre','puesto_votacion','mesa_votacion','movilidad','asistencia'];
 ELSE
  RAISE EXCEPTION USING errcode='22023',message='Conjunto de datos no autorizado para exportación.';
 END CASE;

 IF NOT mira.is_active_admin() THEN
  IF NOT mira.has_module_permission('base_datos_general','view') OR NOT mira.has_module_permission(v_module,'view') THEN
   RAISE EXCEPTION USING errcode='42501',message='No tienes permiso de consulta para este conjunto.';
  END IF;
  IF NOT mira.has_module_permission('base_datos_general','export') THEN
   RAISE EXCEPTION USING errcode='42501',message='No tienes permiso de exportación en Base de datos general. Solicita al administrador que habilite ese permiso.';
  END IF;
  IF NOT mira.has_module_permission(v_module,'export') THEN
   RAISE EXCEPTION USING errcode='42501',message='No tienes permiso de exportación en el módulo de origen ('||v_module||'). Solicita al administrador que habilite ese permiso.';
  END IF;
 END IF;

 IF p_dataset_key='personas' THEN
  IF coalesce(p_person_status,'all') NOT IN ('active','archived','all') THEN
   RAISE EXCEPTION USING errcode='22023',message='Estado de fichas no válido para exportación.';
  END IF;
  IF p_person_status='active' THEN v_where:=v_where||' AND activo IS TRUE'; END IF;
  IF p_person_status='archived' THEN v_where:=v_where||' AND activo IS FALSE'; END IF;
 END IF;

 IF nullif(btrim(coalesce(p_search,'')),'') IS NOT NULL THEN
  FOREACH v_col IN ARRAY v_search_cols LOOP
   v_clause:=format('%I::text ILIKE %L',v_col,'%'||left(btrim(p_search),80)||'%');
   v_search_condition:=v_search_condition||CASE WHEN v_search_condition='' THEN '' ELSE ' OR ' END||v_clause;
  END LOOP;
  IF p_dataset_key='personas' THEN
   v_digits:=regexp_replace(coalesce(p_search,''),'[^0-9]','','g');
   IF v_digits<>'' THEN
    v_search_condition:=v_search_condition||' OR cedula_normalizada='||quote_literal(v_digits);
   END IF;
  END IF;
  IF v_search_condition<>'' THEN v_where:=v_where||' AND ('||v_search_condition||')'; END IF;
 END IF;

 IF nullif(btrim(coalesce(p_filter_field,'')),'') IS NOT NULL AND nullif(btrim(coalesce(p_filter_value,'')),'') IS NOT NULL THEN
  IF NOT p_filter_field=ANY(v_filter_cols) THEN
   RAISE EXCEPTION USING errcode='22023',message='Campo de filtro no permitido.';
  END IF;
  IF p_dataset_key='personas' AND p_filter_field='cedula' THEN
   v_digits:=regexp_replace(coalesce(p_filter_value,''),'[^0-9]','','g');
   IF v_digits='' THEN RAISE EXCEPTION USING errcode='22023',message='La cédula del filtro no contiene dígitos válidos.'; END IF;
   v_where:=v_where||format(' AND cedula_normalizada=%L',v_digits);
  ELSE
   v_where:=v_where||format(' AND %I::text=%L',p_filter_field,left(btrim(p_filter_value),160));
  END IF;
 END IF;

 EXECUTE format('SELECT count(*) FROM mira.%I WHERE true %s',v_table,v_where) INTO v_total_count;
 EXECUTE format(
  'SELECT coalesce(jsonb_agg(to_jsonb(q)),''[]''::jsonb) FROM (SELECT %s FROM mira.%I WHERE true %s ORDER BY %I DESC,id DESC LIMIT %s) q',
  v_select,v_table,v_where,v_order_col,v_limit
 ) INTO v_rows;
 v_count:=jsonb_array_length(v_rows);
 INSERT INTO mira.audit_events(module_key,table_name,record_id,actor_auth_user_id,operation,changed_fields,details)
 VALUES(v_module,v_table,NULL,auth.user_id()::text,'EXPORT','{}'::text[],
  jsonb_build_object('dataset_key',p_dataset_key,'row_count',v_count,'total_count',v_total_count,'truncated',v_total_count>v_count,'person_status',CASE WHEN p_dataset_key='personas' THEN coalesce(p_person_status,'all') ELSE NULL END,'search',left(coalesce(p_search,''),80),'filter_field',coalesce(p_filter_field,''),'filter_value',left(coalesce(p_filter_value,''),160)));
 RETURN jsonb_build_object('rows',v_rows,'count',v_count,'total_count',v_total_count,'truncated',v_total_count>v_count,'dataset_key',p_dataset_key);
END
$function$;

REVOKE ALL ON FUNCTION mira.export_dataset(text,text,text,text,integer,text) FROM PUBLIC,anonymous;
GRANT EXECUTE ON FUNCTION mira.export_dataset(text,text,text,text,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION mira.get_data_quality_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog','mira','auth'
AS $function$
DECLARE
 v_personas jsonb;
 v_infomira jsonb;
 v_actividades jsonb;
 v_admin boolean:=mira.is_active_admin();
BEGIN
 IF auth.user_id() IS NULL OR (NOT v_admin AND NOT mira.has_module_permission('base_datos_general','view')) THEN
  RAISE EXCEPTION USING errcode='42501',message='No tienes permiso para consultar el diagnóstico de calidad.';
 END IF;
 IF v_admin OR mira.has_module_permission('personas','view') THEN
  SELECT jsonb_build_object(
   'total',count(*),
   'active',count(*) FILTER(WHERE activo IS TRUE),
   'archived',count(*) FILTER(WHERE activo IS FALSE),
   'missing_name',count(*) FILTER(WHERE nullif(btrim(nombres),'') IS NULL OR nullif(btrim(apellidos),'') IS NULL),
   'missing_phone',count(*) FILTER(WHERE nullif(btrim(coalesce(telefono,'')),'') IS NULL),
   'missing_neighborhood',count(*) FILTER(WHERE nullif(btrim(coalesce(barrio,'')),'') IS NULL),
   'duplicate_normalized_cedula',0,
   'invalid_phone_format',count(*) FILTER(WHERE nullif(btrim(coalesce(telefono,'')),'') IS NOT NULL AND regexp_replace(telefono,'[^0-9]','','g') !~ '^[0-9]{7,13}$'),
   'pending_flag_mismatch',count(*) FILTER(WHERE datos_pendientes IS DISTINCT FROM (nullif(btrim(coalesce(telefono,'')),'') IS NULL OR nullif(btrim(coalesce(barrio,'')),'') IS NULL))
  ) INTO v_personas FROM mira.personas;
 END IF;
 IF v_admin OR mira.has_module_permission('infomira','view') THEN
  SELECT jsonb_build_object(
   'total',count(*),
   'linked',count(*) FILTER(WHERE persona_id IS NOT NULL),
   'unlinked',count(*) FILTER(WHERE persona_id IS NULL),
   'missing_document',count(*) FILTER(WHERE nullif(regexp_replace(coalesce(cedula_original,''),'[^0-9]','','g'),'') IS NULL),
   'missing_neighborhood',count(*) FILTER(WHERE nullif(btrim(coalesce(barrio,'')),'') IS NULL),
   'duplicate_document_groups',(SELECT count(*) FROM (SELECT regexp_replace(cedula_original,'[^0-9]','','g') d FROM mira.infomira_red WHERE nullif(regexp_replace(coalesce(cedula_original,''),'[^0-9]','','g'),'') IS NOT NULL GROUP BY 1 HAVING count(*)>1) d),
   'duplicate_document_rows',(SELECT coalesce(sum(n),0) FROM (SELECT count(*) n FROM mira.infomira_red WHERE nullif(regexp_replace(coalesce(cedula_original,''),'[^0-9]','','g'),'') IS NOT NULL GROUP BY regexp_replace(cedula_original,'[^0-9]','','g') HAVING count(*)>1) d),
   'linked_document_mismatch',count(*) FILTER(WHERE persona_id IS NOT NULL AND nullif(regexp_replace(coalesce(cedula_original,''),'[^0-9]','','g'),'') IS NOT NULL AND regexp_replace(coalesce(cedula_original,''),'[^0-9]','','g')<>(SELECT p.cedula_normalizada FROM mira.personas p WHERE p.id=infomira_red.persona_id))
  ) INTO v_infomira FROM mira.infomira_red;
 END IF;
 IF v_admin OR mira.has_module_permission('actividades','view') THEN
  SELECT jsonb_build_object(
   'activities', (SELECT count(*) FROM mira.actividades),
   'attendances',(SELECT count(*) FROM mira.asistencias),
   'active_attendances',(SELECT count(*) FROM mira.asistencias WHERE estado='activa'),
   'annulled_attendances',(SELECT count(*) FROM mira.asistencias WHERE estado='anulada'),
   'duplicate_attendance_groups',(SELECT count(*) FROM (SELECT persona_id,actividad_id FROM mira.asistencias GROUP BY persona_id,actividad_id HAVING count(*)>1) d),
   'orphan_person_links',(SELECT count(*) FROM mira.asistencias a LEFT JOIN mira.personas p ON p.id=a.persona_id WHERE p.id IS NULL),
   'orphan_activity_links',(SELECT count(*) FROM mira.asistencias a LEFT JOIN mira.actividades x ON x.id=a.actividad_id WHERE x.id IS NULL)
  ) INTO v_actividades;
 END IF;
 RETURN jsonb_build_object('generated_at',now(),'personas',v_personas,'infomira',v_infomira,'actividades',v_actividades);
END
$function$;

REVOKE ALL ON FUNCTION mira.get_data_quality_summary() FROM PUBLIC,anonymous;
GRANT EXECUTE ON FUNCTION mira.get_data_quality_summary() TO authenticated;
