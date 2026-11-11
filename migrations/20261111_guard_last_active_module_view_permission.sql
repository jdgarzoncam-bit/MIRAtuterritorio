-- Protect the last usable module view permission for active QA users.
-- Scope: Neon QA branch only. Production is not modified.
-- Suspended profiles and the primary administrator are intentionally exempt.

create or replace function mira.guard_last_active_module_view_permission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, mira
as $$
declare
  v_profile_auth_user_id text;
  v_profile_active boolean;
  v_profile_role text;
  v_remaining_views integer;
begin
  if tg_op = 'UPDATE' then
    if old.allowed is distinct from true or old.action_key <> 'view' then
      return new;
    end if;

    -- Moving/changing a permission is safe when this same row remains a
    -- usable view permission for the same active module and same profile.
    if new.user_profile_id = old.user_profile_id
       and new.allowed = true
       and new.action_key = 'view'
       and new.module_key not in ('testigos', 'control_administrativo')
       and exists (
         select 1
         from mira.module_catalog mc
         where mc.module_key = new.module_key
           and mc.active = true
       ) then
      return new;
    end if;
  else
    if old.allowed is distinct from true or old.action_key <> 'view' then
      return old;
    end if;
  end if;

  -- Serialize permission changes for this profile. This prevents concurrent
  -- transactions from each removing a different final view permission.
  select up.auth_user_id, up.active, up.role
    into v_profile_auth_user_id, v_profile_active, v_profile_role
  from mira.user_profiles up
  where up.id = old.user_profile_id
  for update;

  -- Allow profile cascades, suspended users, and the protected primary admin.
  if not found
     or v_profile_active is distinct from true
     or v_profile_auth_user_id = 'beef5bf3-82a8-4c35-a12c-17771be59da1'
     or v_profile_role not in ('operator', 'viewer') then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  select count(*)
    into v_remaining_views
  from mira.module_permissions mp
  join mira.module_catalog mc on mc.module_key = mp.module_key
  where mp.user_profile_id = old.user_profile_id
    and mp.id <> old.id
    and mp.allowed = true
    and mp.action_key = 'view'
    and mc.active = true
    and mp.module_key not in ('testigos', 'control_administrativo');

  if v_remaining_views = 0 then
    raise exception using
      errcode = '23514',
      message = 'No se puede retirar el ultimo permiso de Consulta de una cuenta activa. Asigne otro modulo o suspenda la cuenta primero.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

drop trigger if exists guard_last_active_module_view_permission
  on mira.module_permissions;

create trigger guard_last_active_module_view_permission
before delete or update on mira.module_permissions
for each row
execute function mira.guard_last_active_module_view_permission();
