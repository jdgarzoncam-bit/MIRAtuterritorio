-- MIRA TU TERRITORIO
-- Auditoría común, exportación autorizada en backend y retiro de Reportes Operativos.
-- Aplicar primero en QA y validar antes de promover a producción.

-- La cuenta administradora requiere identidad principal, estado activo y correo verificado.
CREATE OR REPLACE FUNCTION mira.is_active_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','mira','auth'
AS $function$
 SELECT EXISTS (
  SELECT 1 FROM mira.user_profiles u
  WHERE u.auth_user_id=auth.user_id()
    AND u.auth_user_id='beef5bf3-82a8-4c35-a12c-17771be59da1'
    AND u.active=true AND u.email_verified=true AND u.role='admin'
 )
$function$;

CREATE TABLE IF NOT EXISTS mira.audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 module_key text NOT NULL,
 table_name text NOT NULL,
 record_id text,
 actor_auth_user_id text,
 operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE','EXPORT')),
 changed_fields text[] NOT NULL DEFAULT '{}',
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_created_idx ON mira.audit_events (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_events_module_created_idx ON mira.audit_events (module_key, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_created_idx ON mira.audit_events (actor_auth_user_id, created_at DESC);
ALTER TABLE mira.audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mira.audit_events FROM PUBLIC, anonymous;
GRANT SELECT ON mira.audit_events TO authenticated;
DROP POLICY IF EXISTS audit_events_read_authorized ON mira.audit_events;
CREATE POLICY audit_events_read_authorized ON mira.audit_events FOR SELECT TO authenticated USING (
 mira.is_active_admin()
 OR (mira.has_module_permission('base_datos_general','view') AND mira.has_module_permission(module_key,'view'))
);

CREATE OR REPLACE FUNCTION mira.audit_row_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','mira','auth'
AS $function$
DECLARE
 v_old jsonb;
 v_new jsonb;
 v_module text;
 v_record_id text;
 v_fields text[];
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN v_old := to_jsonb(OLD); END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN v_new := to_jsonb(NEW); END IF;
 v_record_id := coalesce(v_new->>'id',v_old->>'id');
 v_module := CASE TG_TABLE_NAME
  WHEN 'personas' THEN 'personas'
  WHEN 'actividades' THEN 'actividades'
  WHEN 'asistencias' THEN 'actividades'
  WHEN 'pqrs' THEN 'pqrs'
  WHEN 'reportes_ciudadanos' THEN 'concejal'
  WHEN 'concejal_actividades' THEN 'concejal'
  WHEN 'concejal_compromisos' THEN 'concejal'
  WHEN 'infomira_red' THEN 'infomira'
  WHEN 'user_profiles' THEN 'control_administrativo'
  WHEN 'module_permissions' THEN 'control_administrativo'
  WHEN 'module_catalog' THEN 'control_administrativo'
  ELSE 'control_administrativo'
 END;
 IF TG_OP='UPDATE' THEN
  SELECT coalesce(array_agg(k ORDER BY k),'{}'::text[]) INTO v_fields
  FROM jsonb_object_keys(v_new) AS keys(k)
  WHERE k NOT IN ('id','created_at','updated_at') AND v_old->k IS DISTINCT FROM v_new->k;
 ELSE
  SELECT coalesce(array_agg(k ORDER BY k),'{}'::text[]) INTO v_fields
  FROM jsonb_object_keys(coalesce(v_new,v_old)) AS keys(k)
  WHERE k NOT IN ('id','created_at','updated_at');
 END IF;
 INSERT INTO mira.audit_events(module_key,table_name,record_id,actor_auth_user_id,operation,changed_fields,details)
 VALUES(v_module,TG_TABLE_NAME,v_record_id,auth.user_id()::text,TG_OP,v_fields,'{}'::jsonb);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS central_audit_personas ON mira.personas;
CREATE TRIGGER central_audit_personas AFTER INSERT OR UPDATE OR DELETE ON mira.personas FOR EACH ROW EXECUTE FUNCTION mira.audit_row_change();
DROP TRIGGER IF EXISTS central_audit_actividades ON mira.actividades;
CREATE TRIGGER central_audit_actividades AFTER INSERT OR UPDATE OR DELETE ON mira.actividades FOR EACH ROW EXECUTE FUNCTION mira.audit_row_change();
DROP TRIGGER IF EXISTS central_audit_asistencias ON mira.asistencias;
CREATE TRIGGER central_audit_asistencias AFTER INSERT OR UPDATE OR DELETE ON mira.asistencias FOR EACH ROW EXECUTE FUNCTION mira.audit_row_change();
DROP TRIGGER IF EXISTS central_audit_pqrs ON mira.pqrs;
CREATE TRIGGER central_audit_pqrs AFTER INSERT OR UPDATE OR DELETE ON mira.pqrs FOR EACH ROW EXECUTE FUNCTION mira.audit_row_change();
DROP TRIGGER IF EXISTS central_audit_reportes_ciudadanos ON mira.reportes_ciudadanos;
CREATE TRIGGER central_audit_reportes_ciudadanos AFTER INSERT OR UPDATE OR DELETE ON mira.reportes_ciudadanos FOR EACH ROW EXECUTE FUNCTION mira.audit_row_change();
DROP TRIGGER IF EXISTS central_audit_concejal_actividades ON mira.concejal_actividades;
CREATE TRIGGER central_audit_concejal_actividades AFTER INSERT OR UPDATE OR DELETE ON mira.concejal_actividades FOR EACH ROW EXECUTE FUNCTION mira.audit_row_change();
DROP TRIGGER IF EXISTS central_audit_concejal_compromisos ON mira.concejal_compromisos;
CREATE TRIGGER central_audit_concejal_compromisos AFTER INSERT OR UPDATE OR DELETE ON mira.concejal_compromisos FOR EACH ROW EXECUTE FUNCTION mira.audit_row_change();
DROP TRIGGER IF EXISTS central_audit_infomira_red ON mira.infomira_red;
CREATE TRIGGER central_audit_infomira_red AFTER INSERT OR UPDATE OR DELETE ON mira.infomira_red FOR EACH ROW EXECUTE FUNCTION mira.audit_row_change();
DROP TRIGGER IF EXISTS central_audit_user_profiles ON mira.user_profiles;
CREATE TRIGGER central_audit_user_profiles AFTER INSERT OR UPDATE OR DELETE ON mira.user_profiles FOR EACH ROW EXECUTE FUNCTION mira.audit_row_change();
DROP TRIGGER IF EXISTS central_audit_module_permissions ON mira.module_permissions;
CREATE TRIGGER central_audit_module_permissions AFTER INSERT OR UPDATE OR DELETE ON mira.module_permissions FOR EACH ROW EXECUTE FUNCTION mira.audit_row_change();
DROP TRIGGER IF EXISTS central_audit_module_catalog ON mira.module_catalog;
CREATE TRIGGER central_audit_module_catalog AFTER INSERT OR UPDATE OR DELETE ON mira.module_catalog FOR EACH ROW EXECUTE FUNCTION mira.audit_row_change();

CREATE OR REPLACE FUNCTION mira.export_dataset(
 p_dataset_key text,
 p_search text DEFAULT '',
 p_filter_field text DEFAULT '',
 p_filter_value text DEFAULT '',
 p_limit integer DEFAULT 100000
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','mira','auth'
AS $function$
DECLARE
 v_table text;
 v_module text;
 v_select text;
 v_search_cols text[];
 v_filter_cols text[];
 v_order_col text := 'created_at';
 v_where text := '';
 v_clause text;
 v_col text;
 v_rows jsonb;
 v_count integer;
 v_limit integer := least(greatest(coalesce(p_limit,100000),1),100000);
BEGIN
 IF auth.user_id() IS NULL THEN RAISE EXCEPTION USING errcode='42501',message='Se requiere una sesión autenticada.'; END IF;
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
 IF nullif(btrim(coalesce(p_search,'')),'') IS NOT NULL THEN
  FOREACH v_col IN ARRAY v_search_cols LOOP
   v_clause := format('%I::text ILIKE %L',v_col,'%'||left(btrim(p_search),80)||'%');
   v_where := v_where || CASE WHEN v_where='' THEN ' AND (' ELSE ' OR ' END || v_clause;
  END LOOP;
  IF v_where<>'' THEN v_where:=v_where||')'; END IF;
 END IF;
 IF nullif(btrim(coalesce(p_filter_field,'')),'') IS NOT NULL AND nullif(btrim(coalesce(p_filter_value,'')),'') IS NOT NULL THEN
  IF NOT p_filter_field=ANY(v_filter_cols) THEN RAISE EXCEPTION USING errcode='22023',message='Campo de filtro no permitido.'; END IF;
  v_where:=v_where||format(' AND %I::text = %L',p_filter_field,left(btrim(p_filter_value),160));
 END IF;
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(q)),''[]''::jsonb) FROM (SELECT %s FROM mira.%I WHERE true %s ORDER BY %I DESC LIMIT %s) q',
  v_select,v_table,v_where,v_order_col,v_limit) INTO v_rows;
 v_count:=jsonb_array_length(v_rows);
 INSERT INTO mira.audit_events(module_key,table_name,record_id,actor_auth_user_id,operation,changed_fields,details)
 VALUES(v_module,v_table,NULL,auth.user_id()::text,'EXPORT','{}'::text[],
  jsonb_build_object('dataset_key',p_dataset_key,'row_count',v_count,'search',left(coalesce(p_search,''),80),'filter_field',coalesce(p_filter_field,''),'filter_value',left(coalesce(p_filter_value,''),160)));
 RETURN jsonb_build_object('rows',v_rows,'count',v_count,'dataset_key',p_dataset_key);
END
$function$;
REVOKE ALL ON FUNCTION mira.export_dataset(text,text,text,text,integer) FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION mira.export_dataset(text,text,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION mira.list_audit_events(
 p_module_key text DEFAULT NULL,
 p_actor text DEFAULT NULL,
 p_operation text DEFAULT NULL,
 p_search text DEFAULT NULL,
 p_limit integer DEFAULT 100,
 p_offset integer DEFAULT 0
) RETURNS SETOF mira.audit_events
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'pg_catalog','mira','auth'
AS $function$
 SELECT e.*
 FROM mira.audit_events e
 WHERE (nullif(btrim(coalesce(p_module_key,'')),'') IS NULL OR e.module_key=p_module_key)
   AND (nullif(btrim(coalesce(p_actor,'')),'') IS NULL OR e.actor_auth_user_id ILIKE '%'||left(btrim(p_actor),160)||'%')
   AND (nullif(btrim(coalesce(p_operation,'')),'') IS NULL OR e.operation=p_operation)
   AND (nullif(btrim(coalesce(p_search,'')),'') IS NULL OR
     concat_ws(' ',e.module_key,e.table_name,e.record_id,e.actor_auth_user_id,e.operation,
       array_to_string(e.changed_fields,','),e.details::text) ILIKE '%'||left(btrim(p_search),160)||'%')
 ORDER BY e.created_at DESC,e.id DESC
 LIMIT least(greatest(coalesce(p_limit,100),1),201)
 OFFSET greatest(coalesce(p_offset,0),0)
$function$;
REVOKE ALL ON FUNCTION mira.list_audit_events(text,text,text,text,integer,integer) FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION mira.list_audit_events(text,text,text,text,integer,integer) TO authenticated;

-- Reportes Operativos no tiene registros ni dependencias funcionales en el código.
-- Se retiran los permisos, el módulo del catálogo y la tabla residual.
DELETE FROM mira.module_permissions WHERE module_key='reportes';
DELETE FROM mira.module_catalog WHERE module_key='reportes';
DROP TABLE mira.reportes_operativos;
