-- MIRA TU TERRITORIO
-- 2026-11-26: Treat legacy inactive person records as NOT enrolled in InfoMIRA for activity registration.
-- Preserve activo/inactivo flags for other modules; this rule applies to InfoMIRA and participant enrollment only.
DO $migration$
DECLARE
  v_registration text;
  v_lookup text;
  v_old_guard text := $old$IF v_person_active IS FALSE OR v_person_inactive IS TRUE THEN
    RAISE EXCEPTION 'Esta ficha requiere revisión administrativa. No se registró la asistencia.';
  END IF;$old$;
  v_new_guard text := $new$IF v_person_active IS FALSE OR v_person_inactive IS TRUE THEN
    v_info_mira := false;
  END IF;$new$;
  v_old_lookup text := $oldlookup$'info_mira',p.info_mira$oldlookup$;
  v_new_lookup text := $newlookup$'info_mira',CASE WHEN p.inactivo OR NOT p.activo THEN false ELSE p.info_mira END$newlookup$;
BEGIN
  SELECT pg_get_functiondef('mira.public_register_activity_participant(text,text,text,text,uuid,boolean)'::regprocedure) INTO v_registration;
  IF position(v_old_guard IN v_registration)=0 THEN RAISE EXCEPTION 'No se encontró el bloqueo de inactivos esperado.'; END IF;
  v_registration:=replace(v_registration,v_old_guard,v_new_guard);
  EXECUTE v_registration;
  SELECT pg_get_functiondef('mira.public_lookup_participant(text,uuid)'::regprocedure) INTO v_lookup;
  IF position(v_old_lookup IN v_lookup)=0 THEN RAISE EXCEPTION 'No se encontró el campo InfoMIRA esperado.'; END IF;
  v_lookup:=replace(v_lookup,v_old_lookup,v_new_lookup);
  EXECUTE v_lookup;
END
$migration$;

-- Existing inactive records are marked as not enrolled in InfoMIRA.
-- Keep activo/inactivo, attendance history and all other person fields unchanged.
UPDATE mira.personas
SET info_mira=false, updated_at=now()
WHERE (inactivo=true OR activo=false)
  AND info_mira IS DISTINCT FROM false;
