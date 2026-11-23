-- InfoMIRA is a consultation-only module.
-- Apply first in QA and validate the authenticated read path before production.

DROP POLICY IF EXISTS infomira_red_permission_create ON mira.infomira_red;
DROP POLICY IF EXISTS infomira_red_permission_edit ON mira.infomira_red;
DROP POLICY IF EXISTS infomira_red_permission_delete ON mira.infomira_red;

REVOKE INSERT, UPDATE, DELETE ON TABLE mira.infomira_red FROM authenticated;
GRANT SELECT ON TABLE mira.infomira_red TO authenticated;

DELETE FROM mira.module_permissions
WHERE module_key = 'infomira'
  AND action_key <> 'view';

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
  WHEN p_module_key = 'infomira' AND p_action_key <> 'view' THEN false
  WHEN p_action_key NOT IN ('view','create','edit','delete','export','manage','annul') THEN false
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
        (u.role = 'operator' AND p_action_key IN ('view','create','edit','export','annul'))
        OR (u.role = 'viewer' AND p_action_key = 'view')
      )
      AND (
        p_action_key = 'view'
        OR EXISTS (
          SELECT 1 FROM mira.module_permissions pv
          WHERE pv.user_profile_id = u.id
            AND pv.module_key = p_module_key
            AND pv.action_key = 'view'
            AND pv.allowed = true
        )
      )
  )
END
$function$;
