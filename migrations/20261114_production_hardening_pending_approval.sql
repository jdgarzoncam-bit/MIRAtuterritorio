-- MIRA TU TERRITORIO
-- Endurecimiento pendiente para PRODUCCION.
-- Estado: PROPUESTA NO APLICADA. Requiere aprobacion explicita antes de ejecutarse.
-- Objetivo: retirar privilegios residuales del modulo reportes_operativos
-- y cerrar EXECUTE PUBLIC en funciones SECURITY DEFINER de produccion.
-- No elimina tablas, filas, usuarios ni historicos.

BEGIN;

-- 1. El modulo reportes_operativos fue retirado.
-- Se conservan tabla y datos historicos; solo se cierran las vias API.
REVOKE INSERT ON TABLE mira.reportes_operativos FROM anonymous;
REVOKE SELECT ON TABLE mira.reportes_operativos FROM authenticated;
DROP POLICY IF EXISTS reports_public_insert ON mira.reportes_operativos;
DROP POLICY IF EXISTS reports_permission_read ON mira.reportes_operativos;

-- 2. Helpers usados por politicas RLS: solo authenticated y owner.
REVOKE EXECUTE ON FUNCTION mira.has_module_permission(text, text) FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION mira.has_module_permission(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION mira.is_active_admin() FROM PUBLIC, anonymous;
GRANT EXECUTE ON FUNCTION mira.is_active_admin() TO authenticated;

-- 3. Funciones invocadas exclusivamente por triggers: no deben exponerse como RPC.
REVOKE EXECUTE ON FUNCTION mira.audit_admin_changes() FROM PUBLIC, anonymous, authenticated;
REVOKE EXECUTE ON FUNCTION mira.enforce_profile_activation_requirements() FROM PUBLIC, anonymous, authenticated;
REVOKE EXECUTE ON FUNCTION mira.sync_auth_user_profile() FROM PUBLIC, anonymous, authenticated;

COMMIT;

-- Validacion posterior obligatoria:
-- a) reportes_operativos no debe mostrar grants a anonymous ni authenticated.
-- b) reportes_operativos no debe tener policies activas.
-- c) has_module_permission/is_active_admin: EXECUTE solo authenticated y owner.
-- d) funciones trigger-only: EXECUTE solo owner.
-- e) comprobar que los formularios publicos de PQRS y reportes_ciudadanos
--    siguen insertando y que ninguna otra tabla publica cambia de permisos.
