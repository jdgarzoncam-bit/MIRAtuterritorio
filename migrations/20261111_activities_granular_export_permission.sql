-- Allow explicitly assigned Activities export permission for operator accounts.
-- Export still requires both actividades:view and actividades:export.
-- Applied to Neon QA branch only.

create or replace function mira.has_module_permission(p_module_key text, p_action_key text)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'mira', 'auth'
as $function$
  select case
    when p_module_key is null or p_action_key is null then false
    when p_module_key = 'testigos' then false
    when p_action_key not in ('view','create','edit','delete','export','manage') then false
    when not exists (
      select 1 from mira.module_catalog mc
      where mc.module_key = p_module_key and mc.active = true
    ) then false
    when mira.is_active_admin() then true
    else exists (
      select 1
      from mira.user_profiles u
      join mira.module_permissions p on p.user_profile_id = u.id
      where u.auth_user_id = auth.user_id()
        and u.active = true
        and u.email_verified = true
        and p.module_key = p_module_key
        and p.action_key = p_action_key
        and p.allowed = true
        and (
          (u.role = 'operator' and p_action_key in ('view','create','edit','export'))
          or (u.role = 'viewer' and p_action_key = 'view')
        )
        and (
          p_action_key = 'view'
          or exists (
            select 1
            from mira.module_permissions pv
            where pv.user_profile_id = u.id
              and pv.module_key = p_module_key
              and pv.action_key = 'view'
              and pv.allowed = true
          )
        )
    )
  end
$function$;
