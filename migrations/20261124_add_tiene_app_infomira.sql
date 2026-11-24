-- Añade el dato independiente de disponibilidad de la aplicación InfoMIRA.
-- NULL significa que todavía no se ha confirmado si la persona tiene la aplicación.
ALTER TABLE mira.personas
  ADD COLUMN IF NOT EXISTS tiene_app_infomira boolean;
