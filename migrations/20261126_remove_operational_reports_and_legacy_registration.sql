-- MIRA TU TERRITORIO
-- Retire the obsolete public Operational Reports module.
-- Audit precondition: the table contained zero rows in production and QA.
-- No citizen-report/PQRS objects are touched.
-- Intentionally no CASCADE: unexpected dependencies must stop this migration.
DELETE FROM mira.module_catalog WHERE module_key = 'reportes';
DROP TABLE IF EXISTS mira.reportes_operativos;
-- Remove the unused legacy overload without token authorization.
-- The active seven-argument overload remains in place and requires the
-- central PIN session token.
DROP FUNCTION IF EXISTS mira.public_register_activity_participant_v2(
  text, text, text, text, uuid, boolean, text, boolean
);
