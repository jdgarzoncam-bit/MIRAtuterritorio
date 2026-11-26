-- MIRA TU TERRITORIO
-- 2026-11-26: Treat legacy inactive people as NOT enrolled in InfoMIRA for activity registration.
-- Supports the two deployed function bodies (QA and production) without replacing unrelated logic.
-- Preserve activo/inactivo flags for other modules and preserve attendance history.
DO $migration$
DECLARE
  v_registration text;
  v_lookup text;
  v_old_guard_qa text := $oldqa$IF v_person_active IS FALSE OR v_person_inactive IS TRUE THEN
    RAISE EXCEPTION 'Esta ficha requiere revisión administrativa. No se registró la asistencia.';
  END IF;$oldqa$;
  v_new_guard_qa text := $newqa$IF v_person_active IS FALSE OR v_person_inactive IS TRUE THEN
    v_info_mira := false;
  END IF;$newqa$;
  v_old_guard_prod text := $oldprod$IF EXISTS(SELECT 1 FROM mira.personas p WHERE p.id=v_persona_id AND (p.activo=false OR p.inactivo=true))
    THEN RAISE EXCEPTION 'Esta ficha requiere revisión administrativa. No se registró la asistencia.'; END IF;$oldprod$;
  v_new_guard_prod text := $newprod$UPDATE mira.personas p
    SET info_mira=false, updated_at=now()
    WHERE p.id=v_persona_id AND (p.activo=false OR p.inactivo=true);
  IF FOUND THEN v_info_mira:=false; END IF;$newprod$;
  v_old_lookup text := $oldlookup$'info_mira',p.info_mira$oldlookup$;
  v_new_lookup text := $newlookup$'info_mira',CASE WHEN p.inactivo OR NOT p.activo THEN false ELSE p.info_mira END$newlookup$;
BEGIN
  SELECT pg_get_functiondef('mira.public_register_activity_participant(text,text,text,text,uuid,boolean)'::regprocedure)
    INTO v_registration;

  IF position(v_old_guard_qa IN v_registration)>0 THEN
    v_registration:=replace(v_registration,v_old_guard_qa,v_new_guard_qa);
  ELSIF position(v_old_guard_prod IN v_registration)>0 THEN
    v_registration:=replace(v_registration,v_old_guard_prod,v_new_guard_prod);
  ELSIF position(v_new_guard_qa IN v_registration)=0
    AND position(v_new_guard_prod IN v_registration)=0 THEN
    RAISE EXCEPTION 'No se reconoció la variante del registro de participantes; no se aplicaron cambios.';
  END IF;

  v_registration:=replace(v_registration,v_old_lookup,v_new_lookup);
  EXECUTE v_registration;

  SELECT pg_get_functiondef('mira.public_lookup_participant(text,uuid)'::regprocedure)
    INTO v_lookup;
  IF position(v_old_lookup IN v_lookup)>0 THEN
    v_lookup:=replace(v_lookup,v_old_lookup,v_new_lookup);
    EXECUTE v_lookup;
  ELSIF position(v_new_lookup IN v_lookup)=0 THEN
    RAISE EXCEPTION 'No se reconoció la consulta de fichas; no se aplicaron cambios.';
  END IF;
END
$migration$;

-- Existing inactive records are marked as not enrolled in InfoMIRA.
-- Do not change activo/inactivo, tiene_app_infomira, personal data or attendance history.
UPDATE mira.personas
SET info_mira=false, updated_at=now()
WHERE (inactivo=true OR activo=false)
  AND info_mira IS DISTINCT FROM false;
