-- MIRA TU TERRITORIO — Modelo de capacidades por rol
-- Fecha: 2026-11-10
-- Estado: probado en rama QA br-wild-surf-b74rsbpz; NO ejecutar en producción sin
-- revisión final, aprobación específica de migración y respaldo verificado.
--
-- UP: aplicar todo el bloque "UP" en una transacción.
-- DOWN: aplicar solo el bloque "DOWN" para revertir. Los valores de role y
-- module_permissions no se borran ni se transforman.

-- ================================ UP ======================================
BEGIN;

CREATE OR REPLACE FUNCTION mira.has_module_permission(p_module_key text, p_action_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'mira', 'auth'
AS $function$
  SELECT CASE
    WHEN p_module_key IS NULL OR p_action_key IS NULL THEN false
    WHEN p_module_key = 'testigos' THEN false
    WHEN p_action_key NOT IN ('view','create','edit','delete','export','manage') THEN false
    WHEN NOT EXISTS (
      SELECT 1 FROM mira.module_catalog mc
      WHERE mc.module_key = p_module_key AND mc.active = true
    ) THEN false
    WHEN mira.is_active_admin() THEN true
    ELSE EXISTS (
      SELECT 1
      FROM mira.user_profiles u
      JOIN mira.module_permissions p ON p.user_profile_id = u.id
      WHERE u.auth_user_id = auth.user_id()
        AND u.active = true
        AND u.email_verified = true
        AND p.module_key = p_module_key
        AND p.action_key = p_action_key
        AND p.allowed = true
        AND (
          (u.role = 'operator' AND p_action_key IN ('view','create','edit'))
          OR (u.role = 'viewer' AND p_action_key = 'view')
        )
        AND (
          p_action_key = 'view'
          OR EXISTS (
            SELECT 1
            FROM mira.module_permissions pv
            WHERE pv.user_profile_id = u.id
              AND pv.module_key = p_module_key
              AND pv.action_key = 'view'
              AND pv.allowed = true
          )
        )
    )
  END
$function$;

-- La comprobación de aprobación se ejecuta al crear o activar una cuenta.
-- Un guardado de rol no debe volver a disparar una aprobación ya existente.
CREATE OR REPLACE FUNCTION mira.enforce_profile_activation_requirements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'mira'
AS $function$
BEGIN
  IF NEW.auth_user_id::text IS DISTINCT FROM 'beef5bf3-82a8-4c35-a12c-17771be59da1'
     AND NEW.active = true
     AND (TG_OP = 'INSERT' OR OLD.active IS DISTINCT FROM true) THEN
    IF NEW.email_verified IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'El correo debe estar confirmado antes de aprobar la cuenta.'
        USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM mira.module_permissions mp
      JOIN mira.module_catalog mc ON mc.module_key = mp.module_key
      WHERE mp.user_profile_id = NEW.id
        AND mp.action_key = 'view'
        AND mp.allowed = true
        AND mc.active = true
        AND mp.module_key NOT IN ('testigos', 'control_administrativo')
    ) THEN
      RAISE EXCEPTION 'Asigna al menos un módulo activo y disponible con permiso Consulta antes de aprobar la cuenta.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION mira.enforce_profile_role_model()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'mira'
AS $function$
BEGIN
  IF NEW.role NOT IN ('admin','operator','viewer','witness') THEN
    RAISE EXCEPTION 'Rol no válido para MIRA TU TERRITORIO.' USING ERRCODE = '23514';
  END IF;
  IF NEW.auth_user_id::text IS DISTINCT FROM 'beef5bf3-82a8-4c35-a12c-17771be59da1'
     AND NEW.role = 'admin' THEN
    RAISE EXCEPTION 'El rol administrador está reservado a la cuenta principal.' USING ERRCODE = '23514';
  END IF;
  IF NEW.role = 'witness' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'witness') THEN
    RAISE EXCEPTION 'El rol Testigo está reservado mientras el módulo Testigos permanece inactivo.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS user_profiles_role_model_guard ON mira.user_profiles;
CREATE TRIGGER user_profiles_role_model_guard
BEFORE INSERT OR UPDATE OF role ON mira.user_profiles
FOR EACH ROW EXECUTE FUNCTION mira.enforce_profile_role_model();

-- Defense in depth: the admin panel only changes these two columns.
REVOKE UPDATE ON TABLE mira.user_profiles FROM authenticated;
GRANT UPDATE (active, role) ON TABLE mira.user_profiles TO authenticated;

COMMIT;


-- =============================== DOWN =====================================
-- Reversión completa a la política anterior. Ejecutar solo si se decide
-- retirar el modelo de roles. No borra permisos ni cambia perfiles.

-- BEGIN;
-- DROP TRIGGER IF EXISTS user_profiles_role_model_guard ON mira.user_profiles;
-- DROP FUNCTION IF EXISTS mira.enforce_profile_role_model();
--
-- CREATE OR REPLACE FUNCTION mira.has_module_permission(p_module_key text, p_action_key text)
-- RETURNS boolean
-- LANGUAGE sql
-- STABLE
-- SECURITY DEFINER
-- SET search_path TO 'pg_catalog', 'mira', 'auth'
-- AS $function$
--   SELECT CASE
--     WHEN p_module_key IS NULL OR p_action_key IS NULL THEN false
--     WHEN p_module_key = 'testigos' THEN false
--     WHEN p_action_key NOT IN ('view','create','edit','delete','export','manage') THEN false
--     WHEN NOT EXISTS (
--       SELECT 1 FROM mira.module_catalog mc
--       WHERE mc.module_key = p_module_key AND mc.active = true
--     ) THEN false
--     WHEN mira.is_active_admin() THEN true
--     ELSE EXISTS (
--       SELECT 1
--       FROM mira.user_profiles u
--       JOIN mira.module_permissions p ON p.user_profile_id = u.id
--       WHERE u.auth_user_id = auth.user_id()
--         AND u.active = true
--         AND u.email_verified = true
--         AND p.module_key = p_module_key
--         AND p.action_key = p_action_key
--         AND p.allowed = true
--     )
--   END
-- $function$;
--
-- CREATE OR REPLACE FUNCTION mira.enforce_profile_activation_requirements()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path TO 'pg_catalog', 'mira'
-- AS $function$
-- BEGIN
--   IF NEW.auth_user_id::text IS DISTINCT FROM 'beef5bf3-82a8-4c35-a12c-17771be59da1'
--      AND NEW.active = true THEN
--     IF NEW.email_verified IS DISTINCT FROM true THEN
--       RAISE EXCEPTION 'El correo debe estar confirmado antes de aprobar la cuenta.'
--         USING ERRCODE = '23514';
--     END IF;
--     IF NOT EXISTS (
--       SELECT 1
--       FROM mira.module_permissions mp
--       JOIN mira.module_catalog mc ON mc.module_key = mp.module_key
--       WHERE mp.user_profile_id = NEW.id
--         AND mp.action_key = 'view'
--         AND mp.allowed = true
--         AND mc.active = true
--         AND mp.module_key NOT IN ('testigos', 'control_administrativo')
--     ) THEN
--       RAISE EXCEPTION 'Asigna al menos un módulo activo y disponible con permiso Consulta antes de aprobar la cuenta.'
--         USING ERRCODE = '23514';
--     END IF;
--   END IF;
--   RETURN NEW;
-- END;
-- $function$;
--
-- REVOKE UPDATE (active, role) ON TABLE mira.user_profiles FROM authenticated;
-- GRANT UPDATE ON TABLE mira.user_profiles TO authenticated;
-- COMMIT;
