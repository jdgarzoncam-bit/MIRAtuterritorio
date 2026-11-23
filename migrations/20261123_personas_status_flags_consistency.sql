-- Reconcile the two existing status flags in QA.
-- Records marked inactive by either field become activo=false / inactivo=true.
UPDATE mira.personas
SET activo = false,
    inactivo = true
WHERE activo IS FALSE OR inactivo IS TRUE;

-- Keep both fields synchronized for future inserts and updates.
CREATE OR REPLACE FUNCTION mira.sync_persona_status_flags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'mira'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.inactivo IS TRUE OR NEW.activo IS FALSE THEN
      NEW.activo := false;
      NEW.inactivo := true;
    ELSE
      NEW.activo := true;
      NEW.inactivo := false;
    END IF;
  ELSIF NEW.inactivo IS DISTINCT FROM OLD.inactivo THEN
    NEW.activo := NOT NEW.inactivo;
  ELSIF NEW.activo IS DISTINCT FROM OLD.activo THEN
    NEW.inactivo := NOT NEW.activo;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS personas_sync_status_flags ON mira.personas;
CREATE TRIGGER personas_sync_status_flags
BEFORE INSERT OR UPDATE OF activo, inactivo ON mira.personas
FOR EACH ROW EXECUTE FUNCTION mira.sync_persona_status_flags();

ALTER TABLE mira.personas
  ADD CONSTRAINT personas_status_flags_consistent
  CHECK (activo = NOT inactivo) NOT VALID;

ALTER TABLE mira.personas
  VALIDATE CONSTRAINT personas_status_flags_consistent;
