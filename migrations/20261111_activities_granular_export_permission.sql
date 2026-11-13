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
    when p_action_key not in ('view','create','edit','delete','export','manage','annul') then false
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

-- Create an activity atomically and finalize prior active activities in one transaction.
-- Requires actividades:create. If another activity is active, also requires actividades:edit.
-- Applied to Neon QA branch only.

create or replace function mira.create_activity_atomic(
  p_nombre text,
  p_fecha date,
  p_lugar text default null,
  p_creado_por text default null
)
returns setof mira.actividades
language plpgsql
security invoker
set search_path = pg_catalog, mira
as $$
declare
  v_activity mira.actividades;
begin
  if nullif(btrim(p_nombre),'') is null or p_fecha is null then
    raise exception using errcode='22023',message='Nombre y fecha son obligatorios.';
  end if;
  if not mira.has_module_permission('actividades','create') then
    raise exception using errcode='42501',message='No tienes permiso para crear actividades.';
  end if;
  if exists(select 1 from mira.actividades where estado='activa')
     and not mira.has_module_permission('actividades','edit') then
    raise exception using errcode='42501',message='Para crear una actividad mientras existe otra activa, también necesitas permiso de edición para finalizar la anterior.';
  end if;
  update mira.actividades
     set estado='finalizada',
         actualizado_por=p_creado_por,
         updated_at=now()
   where estado='activa';
  insert into mira.actividades(nombre,fecha,lugar,estado,creado_por)
  values(btrim(p_nombre),p_fecha,nullif(btrim(p_lugar),''),'activa',p_creado_por)
  returning * into v_activity;
  return next v_activity;
end;
$$;

revoke all on function mira.create_activity_atomic(text,date,text,text) from public, anonymous;
grant execute on function mira.create_activity_atomic(text,date,text,text) to authenticated;


-- Base general de personas y anulacion auditable de asistencias (QA).
alter table mira.personas add column if not exists barrio text;
alter table mira.personas add column if not exists fuente_registro text;
alter table mira.personas add column if not exists datos_pendientes boolean not null default false;
alter table mira.asistencias add column if not exists estado text not null default 'activa';
alter table mira.asistencias add column if not exists anulada_at timestamptz;
alter table mira.asistencias add column if not exists anulada_por text;
alter table mira.asistencias add column if not exists motivo_anulacion text;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='asistencias_estado_check' and conrelid='mira.asistencias'::regclass) then
  alter table mira.asistencias add constraint asistencias_estado_check check (estado in ('activa','anulada'));
 end if;
end $$;
insert into mira.module_catalog(module_key,module_name,description,active,sort_order)
values('personas','Base general de personas','Incorporación, consulta y actualización de fichas generales.',true,15)
on conflict(module_key) do update set module_name=excluded.module_name,description=excluded.description,active=true;
drop policy if exists personas_permission_create on mira.personas;
drop policy if exists personas_permission_edit on mira.personas;
drop policy if exists personas_permission_delete on mira.personas;
drop policy if exists personas_permission_read on mira.personas;
create policy personas_permission_read on mira.personas for select to authenticated using (mira.has_module_permission('personas','view'));
create policy personas_permission_create on mira.personas for insert to authenticated with check (mira.has_module_permission('personas','create'));
create policy personas_permission_edit on mira.personas for update to authenticated using (mira.has_module_permission('personas','edit')) with check (mira.has_module_permission('personas','edit'));
-- Personas are archived through the controlled workflow; direct DELETE is intentionally unavailable.
drop policy if exists asistencias_permission_edit on mira.asistencias;
drop policy if exists asistencias_permission_delete on mira.asistencias;
create policy asistencias_permission_edit on mira.asistencias for update to authenticated using (mira.has_module_permission('actividades','edit')) with check (mira.has_module_permission('actividades','edit'));
-- Las anulaciones se ejecutan exclusivamente mediante la RPC SECURITY DEFINER, con validación granular.
create table if not exists mira.personas_change_audit(id uuid primary key default gen_random_uuid(),persona_id uuid not null,actor_auth_user_id text,action_key text not null,changed_fields text[] not null default '{}',created_at timestamptz not null default now());
create table if not exists mira.asistencias_change_audit(id uuid primary key default gen_random_uuid(),asistencia_id uuid not null,actor_auth_user_id text,action_key text not null,reason text,created_at timestamptz not null default now());
create table if not exists mira.actividades_change_audit(id uuid primary key default gen_random_uuid(),actividad_id uuid not null,actor_auth_user_id text,action_key text not null,changed_fields text[] not null default '{}',created_at timestamptz not null default now());
alter table mira.personas_change_audit enable row level security;
alter table mira.asistencias_change_audit enable row level security;
alter table mira.actividades_change_audit enable row level security;
drop policy if exists personas_change_audit_admin_read on mira.personas_change_audit;
drop policy if exists asistencias_change_audit_admin_read on mira.asistencias_change_audit;
drop policy if exists actividades_change_audit_read on mira.actividades_change_audit;
create policy personas_change_audit_admin_read on mira.personas_change_audit for select to authenticated using (mira.has_module_permission('base_datos_general','view') and mira.has_module_permission('personas','view'));
create policy asistencias_change_audit_admin_read on mira.asistencias_change_audit for select to authenticated using (mira.has_module_permission('base_datos_general','view') and mira.has_module_permission('actividades','view'));
create policy actividades_change_audit_read on mira.actividades_change_audit for select to authenticated using (mira.has_module_permission('base_datos_general','view') and mira.has_module_permission('actividades','view'));
create or replace function mira.audit_persona_changes() returns trigger language plpgsql security definer set search_path=pg_catalog,mira,auth as $$
declare v_fields text[] := '{}'; v_actor text;
begin
 v_actor:=coalesce(auth.user_id()::text,'unknown');
 if TG_OP='INSERT' then
  insert into mira.personas_change_audit(persona_id,actor_auth_user_id,action_key,changed_fields) values(NEW.id,v_actor,'created',array['cedula','nombres','apellidos','barrio','puesto_votacion','mesa_votacion']);
  return NEW;
 end if;
 if NEW.nombres is distinct from OLD.nombres then v_fields:=array_append(v_fields,'nombres'); end if;
 if NEW.apellidos is distinct from OLD.apellidos then v_fields:=array_append(v_fields,'apellidos'); end if;
 if NEW.telefono is distinct from OLD.telefono then v_fields:=array_append(v_fields,'telefono'); end if;
 if NEW.correo is distinct from OLD.correo then v_fields:=array_append(v_fields,'correo'); end if;
 if NEW.barrio is distinct from OLD.barrio then v_fields:=array_append(v_fields,'barrio'); end if;
 if NEW.puesto_votacion is distinct from OLD.puesto_votacion then v_fields:=array_append(v_fields,'puesto_votacion'); end if;
 if NEW.mesa_votacion is distinct from OLD.mesa_votacion then v_fields:=array_append(v_fields,'mesa_votacion'); end if;
 if NEW.activo is distinct from OLD.activo then v_fields:=array_append(v_fields,'activo'); end if;
 if cardinality(v_fields)>0 then insert into mira.personas_change_audit(persona_id,actor_auth_user_id,action_key,changed_fields) values(NEW.id,v_actor,'updated',v_fields); end if;
 return NEW;
end $$;
drop trigger if exists trg_audit_persona_changes on mira.personas;
create trigger trg_audit_persona_changes after insert or update on mira.personas for each row execute function mira.audit_persona_changes();
create or replace function mira.audit_asistencia_changes() returns trigger language plpgsql security definer set search_path=pg_catalog,mira,auth as $
begin
 if TG_OP='INSERT' then
  insert into mira.asistencias_change_audit(asistencia_id,actor_auth_user_id,action_key) values(NEW.id,coalesce(auth.user_id()::text,'unknown'),'created');
  return NEW;
 elsif TG_OP='DELETE' then
  insert into mira.asistencias_change_audit(asistencia_id,actor_auth_user_id,action_key,reason) values(OLD.id,coalesce(auth.user_id()::text,'unknown'),'deleted','Eliminación registrada por trigger');
  return OLD;
 elsif NEW.estado is distinct from OLD.estado then
  insert into mira.asistencias_change_audit(asistencia_id,actor_auth_user_id,action_key,reason) values(NEW.id,coalesce(auth.user_id()::text,'unknown'),case when NEW.estado='anulada' then 'annulled' else 'reactivated' end,NEW.motivo_anulacion);
 elsif (NEW.persona_id,NEW.actividad_id,NEW.observaciones) is distinct from (OLD.persona_id,OLD.actividad_id,OLD.observaciones) then
  insert into mira.asistencias_change_audit(asistencia_id,actor_auth_user_id,action_key,reason) values(NEW.id,coalesce(auth.user_id()::text,'unknown'),'updated','Datos de asistencia modificados');
 end if;
 return NEW;
end $$;
drop trigger if exists trg_audit_asistencia_changes on mira.asistencias;
create trigger trg_audit_asistencia_changes after insert or update or delete on mira.asistencias for each row execute function mira.audit_asistencia_changes();
create or replace function mira.has_module_permission(p_module_key text,p_action_key text)
returns boolean language sql stable security definer set search_path to 'pg_catalog','mira','auth' as $function$
select case
 when p_module_key is null or p_action_key is null then false
 when p_module_key='testigos' then false
 when p_action_key not in ('view','create','edit','delete','export','manage','annul') then false
 when not exists(select 1 from mira.module_catalog mc where mc.module_key=p_module_key and mc.active=true) then false
 when mira.is_active_admin() then true
 else exists(select 1 from mira.user_profiles u join mira.module_permissions p on p.user_profile_id=u.id
  where u.auth_user_id=auth.user_id() and u.active=true and u.email_verified=true
  and p.module_key=p_module_key and p.action_key=p_action_key and p.allowed=true
  and ((u.role='operator' and p_action_key in ('view','create','edit','export','annul')) or (u.role='viewer' and p_action_key='view'))
  and (p_action_key='view' or exists(select 1 from mira.module_permissions pv where pv.user_profile_id=u.id and pv.module_key=p_module_key and pv.action_key='view' and pv.allowed=true)))
end $function$;
create or replace function mira.audit_actividad_changes() returns trigger language plpgsql security definer set search_path=pg_catalog,mira,auth as $$
declare v_fields text[] := '{}';
begin
 if TG_OP='INSERT' then
  insert into mira.actividades_change_audit(actividad_id,actor_auth_user_id,action_key,changed_fields) values(NEW.id,coalesce(auth.user_id()::text,'unknown'),'created',array['nombre','fecha','lugar','estado']);
  return NEW;
 end if;
 if NEW.nombre is distinct from OLD.nombre then v_fields:=array_append(v_fields,'nombre'); end if;
 if NEW.fecha is distinct from OLD.fecha then v_fields:=array_append(v_fields,'fecha'); end if;
 if NEW.lugar is distinct from OLD.lugar then v_fields:=array_append(v_fields,'lugar'); end if;
 if NEW.estado is distinct from OLD.estado then v_fields:=array_append(v_fields,'estado'); end if;
 if cardinality(v_fields)>0 then insert into mira.actividades_change_audit(actividad_id,actor_auth_user_id,action_key,changed_fields) values(NEW.id,coalesce(auth.user_id()::text,'unknown'),'updated',v_fields); end if;
 return NEW;
end $$;
drop trigger if exists trg_audit_actividad_changes on mira.actividades;
create trigger trg_audit_actividad_changes after insert or update on mira.actividades for each row execute function mira.audit_actividad_changes();
create or replace function mira.annul_attendance(p_attendance_id uuid,p_reason text)
returns setof mira.asistencias
language plpgsql
security definer
set search_path=pg_catalog,mira,auth
as $$
begin
 if auth.user_id() is null then raise exception using errcode='42501',message='Se requiere una sesión autenticada.'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception using errcode='22023',message='Indica el motivo de anulación.'; end if;
 if not mira.has_module_permission('actividades','annul') then raise exception using errcode='42501',message='No tienes permiso para anular asistencias.'; end if;
 return query update mira.asistencias set estado='anulada',anulada_at=now(),anulada_por=auth.user_id()::text,motivo_anulacion=btrim(p_reason) where id=p_attendance_id and estado='activa' returning *;
 if not found then raise exception using errcode='P0002',message='La asistencia no existe o ya está anulada.'; end if;
end $$;
revoke all on function mira.annul_attendance(uuid,text) from public,anonymous;
grant execute on function mira.annul_attendance(uuid,text) to authenticated;

-- Sincronizar la restricción SQL con las capacidades granulares del panel.
alter table mira.module_permissions drop constraint if exists module_permissions_action_key_check;
alter table mira.module_permissions add constraint module_permissions_action_key_check check (action_key = any (array['view','create','edit','delete','export','manage','annul']::text[]));

-- Explorador de conjuntos autorizados del Centro de Operaciones.
INSERT INTO mira.module_catalog (module_key,module_name,description,active,sort_order)
VALUES ('base_datos_general','Base de datos general','Explorador de conjuntos de información autorizados con navegación y permisos diferenciados.',true,20)
ON CONFLICT (module_key) DO UPDATE
SET module_name=EXCLUDED.module_name,
    description=EXCLUDED.description,
    active=true,
    sort_order=EXCLUDED.sort_order;
