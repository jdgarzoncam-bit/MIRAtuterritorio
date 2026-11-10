-- PQRS: lectura delegada por permiso granular.
-- Los usuarios con pqrs:view pueden consultar la bandeja; únicamente la cuenta
-- administradora principal conserva UPDATE/DELETE mediante las políticas existentes.
BEGIN;

DROP POLICY IF EXISTS pqrs_read_owner_or_admin ON mira.pqrs;

CREATE POLICY pqrs_read_owner_admin_or_delegated
  ON mira.pqrs
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.user_id()
    OR mira.is_active_admin()
    OR mira.has_module_permission('pqrs', 'view')
  );

GRANT SELECT ON mira.pqrs TO authenticated;

-- No modificar pqrs_admin_update ni pqrs_admin_delete:
-- ambas continúan exigiendo mira.is_active_admin().

COMMIT;
