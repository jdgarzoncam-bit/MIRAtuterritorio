-- MIRA TU TERRITORIO
-- Allow authenticated callers to update only account status and role.
-- RLS policy profile_admin_update_non_admin continues to restrict updates
-- to the primary active administrator and excludes administrator profiles.
-- Trigger guards continue to require verified email and reserve admin/witness roles.
BEGIN;
GRANT UPDATE (active, role) ON TABLE mira.user_profiles TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
