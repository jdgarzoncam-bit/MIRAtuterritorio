-- MIRA TU TERRITORIO
-- Route Control Administrativo writes through narrowly scoped, audited RPCs.
-- The browser never receives broad UPDATE privileges over user_profiles.
BEGIN;

CREATE OR REPLACE FUNCTION mira.admin_update_user_profile(
  p_profile_id uuid,
  p_active boolean,
  p_role text
)
RETURNS SETOF mira.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'mira', 'auth'
AS $function$
BEGIN
  IF NOT mira.is_active_admin() THEN
    RAISE EXCEPTION 'No tienes autorización para administrar cuentas.'
      USING ERRCODE = '42501';
  END IF;

  IF p_profile_id IS NULL OR p_active IS NULL OR p_role NOT IN ('viewer','operator') THEN
    RAISE EXCEPTION 'Los datos de aprobación o rol no son válidos.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mira.user_profiles
    WHERE id = p_profile_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'La cuenta administradora principal está protegida.'
      USING ERRCODE = '42501';
  END IF;

  IF p_active IS TRUE AND NOT EXISTS (
    SELECT 1 FROM mira.user_profiles
    WHERE id = p_profile_id AND email_verified IS TRUE
  ) THEN
    RAISE EXCEPTION 'El correo debe estar confirmado antes de aprobar la cuenta.'
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY
  UPDATE mira.user_profiles AS u
     SET active = p_active,
         role = p_role
   WHERE u.id = p_profile_id
     AND u.role <> 'admin'
  RETURNING u.*;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la cuenta que deseas actualizar.'
      USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION mira.admin_set_module_permission(
  p_profile_id uuid,
  p_module_key text,
  p_action_key text,
  p_allowed boolean
)
RETURNS SETOF mira.module_permissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'mira', 'auth'
AS $function$
DECLARE
  v_role text;
BEGIN
  IF NOT mira.is_active_admin() THEN
    RAISE EXCEPTION 'No tienes autorización para administrar permisos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_profile_id IS NULL OR nullif(trim(p_module_key),'') IS NULL
     OR p_action_key NOT IN ('view','create','edit','export','annul')
     OR p_allowed IS NULL THEN
    RAISE EXCEPTION 'Los datos del permiso no son válidos.'
      USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_role
  FROM mira.user_profiles
  WHERE id = p_profile_id AND role <> 'admin';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró una cuenta administrable.'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mira.module_catalog
    WHERE module_key = p_module_key AND active IS TRUE
      AND module_key NOT IN ('control_administrativo','testigos','centro_operaciones')
  ) THEN
    RAISE EXCEPTION 'El módulo no está disponible para asignación de permisos.'
      USING ERRCODE = '22023';
  END IF;

  IF p_allowed IS TRUE AND p_action_key <> 'view' AND v_role <> 'operator' THEN
    RAISE EXCEPTION 'El rol Consulta no permite conceder acciones operativas.'
      USING ERRCODE = '42501';
  END IF;

  IF p_allowed IS TRUE AND p_action_key <> 'view' AND NOT EXISTS (
    SELECT 1 FROM mira.module_permissions
    WHERE user_profile_id = p_profile_id
      AND module_key = p_module_key
      AND action_key = 'view'
      AND allowed IS TRUE
  ) THEN
    RAISE EXCEPTION 'Primero debes habilitar Consulta en el módulo.'
      USING ERRCODE = '23514';
  END IF;

  IF p_action_key = 'view' AND p_allowed IS FALSE AND EXISTS (
    SELECT 1 FROM mira.module_permissions
    WHERE user_profile_id = p_profile_id
      AND module_key = p_module_key
      AND action_key <> 'view'
      AND allowed IS TRUE
  ) THEN
    RAISE EXCEPTION 'Retira primero las demás acciones habilitadas en este módulo.'
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY
  INSERT INTO mira.module_permissions(user_profile_id,module_key,action_key,allowed)
  VALUES(p_profile_id,p_module_key,p_action_key,p_allowed)
  ON CONFLICT(user_profile_id,module_key,action_key)
  DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now()
  RETURNING *;
END;
$function$;

REVOKE ALL ON FUNCTION mira.admin_update_user_profile(uuid,boolean,text) FROM PUBLIC, anonymous, authenticated;
REVOKE ALL ON FUNCTION mira.admin_set_module_permission(uuid,text,text,boolean) FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION mira.admin_update_user_profile(uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION mira.admin_set_module_permission(uuid,text,text,boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
