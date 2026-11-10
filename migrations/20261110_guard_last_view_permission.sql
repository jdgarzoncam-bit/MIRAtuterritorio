-- Evita que una cuenta activa pierda su último módulo de consulta.
-- El administrador debe suspenderla o asignarle otro permiso view antes de retirar el último.
BEGIN;

CREATE OR REPLACE FUNCTION mira.prevent_last_active_view_permission_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mira
AS $function$
DECLARE
  v_profile_id uuid;
  v_module_key text;
  v_auth_user_id uuid;
  v_active boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.action_key <> 'view' OR OLD.allowed IS DISTINCT FROM true THEN
      RETURN OLD;
    END IF;
    v_profile_id := OLD.user_profile_id;
    v_module_key := OLD.module_key;
  ELSE
    IF OLD.action_key <> 'view' OR OLD.allowed IS DISTINCT FROM true THEN
      RETURN NEW;
    END IF;
    IF NEW.action_key = 'view'
       AND NEW.allowed IS TRUE
       AND NEW.module_key = OLD.module_key
       AND NEW.user_profile_id = OLD.user_profile_id THEN
      RETURN NEW;
    END IF;
    v_profile_id := OLD.user_profile_id;
    v_module_key := OLD.module_key;
  END IF;

  SELECT u.auth_user_id, u.active
    INTO v_auth_user_id, v_active
  FROM mira.user_profiles u
  WHERE u.id = v_profile_id;

  IF NOT FOUND OR v_active IS NOT TRUE
     OR v_auth_user_id::text = 'beef5bf3-82a8-4c35-a12c-17771be59da1' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM mira.module_permissions p
    JOIN mira.module_catalog mc ON mc.module_key = p.module_key
    WHERE p.user_profile_id = v_profile_id
      AND p.action_key = 'view'
      AND p.allowed IS TRUE
      AND mc.active IS TRUE
      AND p.module_key NOT IN ('testigos', 'control_administrativo')
      AND p.module_key <> v_module_key
  ) THEN
    RAISE EXCEPTION 'No puedes retirar el último permiso de Consulta de una cuenta activa. Suspende la cuenta o asigna primero otro módulo de consulta.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

DROP TRIGGER IF EXISTS module_permissions_preserve_last_view ON mira.module_permissions;
CREATE TRIGGER module_permissions_preserve_last_view
BEFORE UPDATE OF user_profile_id, module_key, action_key, allowed OR DELETE
ON mira.module_permissions
FOR EACH ROW
EXECUTE FUNCTION mira.prevent_last_active_view_permission_removal();

CREATE OR REPLACE FUNCTION mira.prevent_active_module_deactivation_without_replacement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mira
AS $function$
BEGIN
  IF OLD.active IS NOT TRUE OR NEW.active IS NOT FALSE THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM mira.user_profiles u
    JOIN mira.module_permissions p
      ON p.user_profile_id = u.id
     AND p.module_key = OLD.module_key
     AND p.action_key = 'view'
     AND p.allowed IS TRUE
    WHERE u.active IS TRUE
      AND u.auth_user_id::text <> 'beef5bf3-82a8-4c35-a12c-17771be59da1'
      AND NOT EXISTS (
        SELECT 1
        FROM mira.module_permissions other_p
        JOIN mira.module_catalog other_mc
          ON other_mc.module_key = other_p.module_key
        WHERE other_p.user_profile_id = u.id
          AND other_p.action_key = 'view'
          AND other_p.allowed IS TRUE
          AND other_mc.active IS TRUE
          AND other_p.module_key NOT IN ('testigos', 'control_administrativo')
          AND other_p.module_key <> OLD.module_key
      )
  ) THEN
    RAISE EXCEPTION 'No puedes desactivar este módulo: dejaría una o más cuentas activas sin un módulo de Consulta. Suspende esas cuentas o asigna otro módulo antes de continuar.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS module_catalog_preserve_active_user_access ON mira.module_catalog;
CREATE TRIGGER module_catalog_preserve_active_user_access
BEFORE UPDATE OF active ON mira.module_catalog
FOR EACH ROW
EXECUTE FUNCTION mira.prevent_active_module_deactivation_without_replacement();

COMMIT;
