-- MIRA TU TERRITORIO
-- Remove direct row deletion grants from application roles.
-- Controlled attendance deletion remains available through delete_attendance(uuid),
-- a SECURITY DEFINER RPC that checks the central module permission and writes audit.
-- Person records are archived/reactivated, not physically deleted through the API.
REVOKE DELETE ON TABLE mira.asistencias FROM PUBLIC, anonymous, authenticated;
REVOKE DELETE ON TABLE mira.personas FROM PUBLIC, anonymous, authenticated;
