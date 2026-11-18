-- MIRA TU TERRITORIO — Integridad de cédula en Personas
-- Fecha: 2026-11-18
-- Ensayada primero en qa-personas-integrity-2026-11-18.
-- Aplicar a la rama Neon QA compartida únicamente con autorización expresa.
-- No modifica valores de cédula existentes; el trigger deriva el campo normalizado
-- desde cedula en cada INSERT/UPDATE. La restricción UNIQUE existente se conserva.

BEGIN;

CREATE OR REPLACE FUNCTION mira.normalize_person_cedula()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, mira
AS $function$
DECLARE
  v_digits text;
BEGIN
  v_digits := regexp_replace(coalesce(NEW.cedula, ''), '[^0-9]', '', 'g');
  IF v_digits = '' THEN
    RAISE EXCEPTION 'La cédula debe contener al menos un dígito.'
      USING ERRCODE = '23514';
  END IF;
  NEW.cedula_normalizada := v_digits;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS personas_normalize_cedula ON mira.personas;
CREATE TRIGGER personas_normalize_cedula
BEFORE INSERT OR UPDATE ON mira.personas
FOR EACH ROW EXECUTE FUNCTION mira.normalize_person_cedula();

ALTER TABLE mira.personas
  ALTER COLUMN cedula_normalizada SET NOT NULL;

ALTER TABLE mira.personas
  ADD CONSTRAINT personas_cedula_normalizada_consistente
  CHECK (cedula_normalizada = regexp_replace(cedula, '[^0-9]', '', 'g'))
  NOT VALID;

ALTER TABLE mira.personas
  VALIDATE CONSTRAINT personas_cedula_normalizada_consistente;

COMMIT;

-- La restricción UNIQUE personas_cedula_unica permanece activa.
-- PostgreSQL serializa las escrituras concurrentes sobre la misma clave única:
-- una segunda inserción/actualización con el mismo documento se rechaza (23505).
