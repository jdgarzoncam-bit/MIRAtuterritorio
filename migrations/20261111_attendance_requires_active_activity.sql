-- Enforce attendance only for activities currently marked active.
-- Applied to Neon QA branch qa-role-capabilities-2026-11-10 only.
-- Existing historical attendance rows are preserved.

create or replace function mira.enforce_attendance_active_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, mira
as $$
declare
  v_activity_state text;
begin
  if tg_op = 'INSERT' or new.actividad_id is distinct from old.actividad_id then
    select a.estado into v_activity_state
    from mira.actividades a
    where a.id = new.actividad_id;

    if v_activity_state is distinct from 'activa' then
      raise exception using
        errcode = '23514',
        message = 'No se pueden registrar asistencias en una actividad que no esté activa.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function mira.enforce_attendance_active_activity()
  from public, anonymous, authenticated;

create trigger asistencias_require_active_activity
before insert or update of actividad_id on mira.asistencias
for each row
execute function mira.enforce_attendance_active_activity();
