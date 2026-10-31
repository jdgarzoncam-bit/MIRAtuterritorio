-- MIRA TU TERRITORIO — políticas de acceso aplicadas en la rama Neon production.
-- El esquema mira contiene datos de trabajo. No conceder acceso público general.
-- Roles de la Data API: anonymous y authenticated.

GRANT USAGE ON SCHEMA mira TO anonymous, authenticated;
GRANT INSERT ON mira.reportes_operativos TO anonymous;
GRANT SELECT, INSERT, UPDATE, DELETE ON mira.personas, mira.actividades, mira.asistencias TO authenticated;
GRANT SELECT ON mira.user_profiles, mira.reportes_operativos TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA mira TO authenticated, anonymous;

ALTER TABLE mira.reportes_operativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mira.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mira.actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE mira.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE mira.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY reportes_public_insert ON mira.reportes_operativos FOR INSERT TO anonymous
WITH CHECK (length(trim(puesto_votacion)) BETWEEN 3 AND 160 AND length(trim(mesa_votacion)) BETWEEN 1 AND 40 AND length(trim(descripcion)) BETWEEN 5 AND 1500);
CREATE POLICY reportes_authenticated_read ON mira.reportes_operativos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM mira.user_profiles u WHERE u.auth_user_id = auth.user_id()::text AND u.active = true AND u.role IN ('admin','operator','viewer')));

CREATE POLICY personas_staff_read ON mira.personas FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM mira.user_profiles u WHERE u.auth_user_id = auth.user_id()::text AND u.active = true AND u.role IN ('admin','operator','viewer')));
CREATE POLICY personas_staff_write ON mira.personas FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM mira.user_profiles u WHERE u.auth_user_id = auth.user_id()::text AND u.active = true AND u.role IN ('admin','operator')))
WITH CHECK (EXISTS (SELECT 1 FROM mira.user_profiles u WHERE u.auth_user_id = auth.user_id()::text AND u.active = true AND u.role IN ('admin','operator')));

CREATE POLICY actividades_staff_read ON mira.actividades FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM mira.user_profiles u WHERE u.auth_user_id = auth.user_id()::text AND u.active = true AND u.role IN ('admin','operator','viewer')));
CREATE POLICY actividades_staff_write ON mira.actividades FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM mira.user_profiles u WHERE u.auth_user_id = auth.user_id()::text AND u.active = true AND u.role IN ('admin','operator')))
WITH CHECK (EXISTS (SELECT 1 FROM mira.user_profiles u WHERE u.auth_user_id = auth.user_id()::text AND u.active = true AND u.role IN ('admin','operator')));

CREATE POLICY asistencias_staff_read ON mira.asistencias FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM mira.user_profiles u WHERE u.auth_user_id = auth.user_id()::text AND u.active = true AND u.role IN ('admin','operator','viewer')));
CREATE POLICY asistencias_staff_write ON mira.asistencias FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM mira.user_profiles u WHERE u.auth_user_id = auth.user_id()::text AND u.active = true AND u.role IN ('admin','operator')));

CREATE POLICY profile_self_read ON mira.user_profiles FOR SELECT TO authenticated
USING (auth_user_id = auth.user_id()::text);


-- Formulario público de testigos: solo inserción anónima, lectura/actualización interna.
GRANT INSERT ON mira.testigos_publicos TO anonymous;
GRANT SELECT, UPDATE ON mira.testigos_publicos TO authenticated;
ALTER TABLE mira.testigos_publicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY testigos_public_insert ON mira.testigos_publicos FOR INSERT TO anonymous
WITH CHECK (consentimiento_datos = true AND length(trim(nombres)) BETWEEN 2 AND 100 AND length(trim(apellidos)) BETWEEN 2 AND 100 AND length(trim(puesto_votacion)) BETWEEN 3 AND 160);
CREATE POLICY testigos_staff_read ON mira.testigos_publicos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM mira.user_profiles u WHERE u.auth_user_id = auth.user_id()::text AND u.active = true AND u.role IN ('admin','operator','viewer')));
CREATE POLICY testigos_staff_update ON mira.testigos_publicos FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM mira.user_profiles u WHERE u.auth_user_id = auth.user_id()::text AND u.active = true AND u.role IN ('admin','operator')))
WITH CHECK (EXISTS (SELECT 1 FROM mira.user_profiles u WHERE u.auth_user_id = auth.user_id()::text AND u.active = true AND u.role IN ('admin','operator')));

-- Defensa adicional: estas tablas aún no se exponen a roles de la Data API.
ALTER TABLE mira.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mira.evidencias ENABLE ROW LEVEL SECURITY;
