-- Least-privilege hardening for MIRA QA.
-- Apply only to Neon QA branch qa-role-capabilities-2026-11-10.
-- No production database changes are included.

-- The operational reports module was retired. Remove residual API grants.
revoke insert on table mira.reportes_operativos from anonymous;
revoke select on table mira.reportes_operativos from authenticated;

-- Authorization helpers are required by authenticated RLS policies only.
revoke execute on function mira.has_module_permission(text, text) from public, anonymous;
grant execute on function mira.has_module_permission(text, text) to authenticated;

revoke execute on function mira.is_active_admin() from public, anonymous;
grant execute on function mira.is_active_admin() to authenticated;

-- Trigger-only functions must not be callable as ordinary API functions.
-- PostgreSQL invokes them through their attached triggers.
revoke execute on function mira.audit_admin_changes() from public, anonymous, authenticated;
revoke execute on function mira.guard_last_active_module_view_permission() from public, anonymous, authenticated;
revoke execute on function mira.enforce_profile_activation_requirements() from public, anonymous, authenticated;
revoke execute on function mira.enforce_profile_role_model() from public, anonymous, authenticated;
revoke execute on function mira.sync_auth_user_profile() from public, anonymous, authenticated;

-- Public anonymous inserts remain intentionally limited to the citizen forms:
-- mira.pqrs and mira.reportes_ciudadanos. RLS WITH CHECK constraints still apply.
