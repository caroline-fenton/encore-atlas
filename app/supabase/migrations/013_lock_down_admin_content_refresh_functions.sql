-- Supabase grants function execution to API roles by default. The admin
-- refresh RPCs are service-role-only and must not be callable directly.
revoke execute on function public.current_artist_content_snapshot(uuid)
  from public, anon, authenticated;

revoke execute on function public.publish_admin_content_refresh(uuid)
  from public, anon, authenticated;

grant execute on function public.current_artist_content_snapshot(uuid)
  to service_role;

grant execute on function public.publish_admin_content_refresh(uuid)
  to service_role;
