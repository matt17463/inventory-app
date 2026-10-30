-- Admin-managed, staff-visible private Tailscale gateway locator, never a secret.
CREATE TABLE IF NOT EXISTS public.sc_local_ai_connections (
  id text PRIMARY KEY DEFAULT 'primary' CHECK (id='primary'),
  endpoint_url text NOT NULL CHECK (
    endpoint_url ~ '^https://[a-z0-9-]+\.tail934ae0\.ts\.net(:[0-9]{2,5})?$'
  ),
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sc_local_ai_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sc_local_ai_connections FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.sc_local_ai_connections TO authenticated;
DROP POLICY IF EXISTS sc_local_ai_staff_view ON public.sc_local_ai_connections;
CREATE POLICY sc_local_ai_staff_view ON public.sc_local_ai_connections
  FOR SELECT TO authenticated
  USING ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing']::text[])));
DROP POLICY IF EXISTS sc_local_ai_admin_insert ON public.sc_local_ai_connections;
CREATE POLICY sc_local_ai_admin_insert ON public.sc_local_ai_connections
  FOR INSERT TO authenticated
  WITH CHECK (updated_by=(select auth.uid()) AND
      (select public.sc_internal_access_allowed(array['admin','manager']::text[])));
DROP POLICY IF EXISTS sc_local_ai_admin_update ON public.sc_local_ai_connections;
CREATE POLICY sc_local_ai_admin_update ON public.sc_local_ai_connections
  FOR UPDATE TO authenticated
  USING ((select public.sc_internal_access_allowed(array['admin','manager']::text[])))
  WITH CHECK (updated_by=(select auth.uid()) AND
      (select public.sc_internal_access_allowed(array['admin','manager']::text[])));
