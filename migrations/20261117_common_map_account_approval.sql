-- MIRA TU TERRITORIO — Aprobación de cuenta independiente de módulos privados
-- Fecha: 2026-11-17
-- Aplicar primero en la rama Neon aislada qa-control-admin-2026-11-17.
-- No ejecutar en producción sin autorización expresa.
--
-- Política:
-- 1. Una cuenta activa y con correo verificado puede utilizar el mapa común
--    (Barrios y puestos de votación) sin permisos privados adicionales.
-- 2. El acceso a módulos/datasets privados sigue dependiendo de
--    mira.has_module_permission() y de sus políticas RLS.
-- 3. La matriz ya no exige conservar un permiso view privado para mantener
--    activa una cuenta: el mapa común no depende de module_permissions.
--
-- No modifica perfiles, roles, permisos guardados ni datos de negocio.

BEGIN;

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
  END IF;
  RETURN NEW;
END;
$function$;

-- Ya no se exige que una cuenta activa conserve un módulo privado con view:
-- el mapa común permanece disponible mientras la cuenta esté activa/verificada.
DROP TRIGGER IF EXISTS guard_last_active_module_view_permission
  ON mira.module_permissions;

COMMIT;

-- Validación posterior (solo lectura):
-- SELECT pg_get_functiondef('mira.enforce_profile_activation_requirements()'::regprocedure);
-- SELECT tgname FROM pg_trigger
-- WHERE tgrelid='mira.module_permissions'::regclass AND NOT tgisinternal
-- ORDER BY tgname;
