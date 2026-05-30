
-- 1) DELETE policies for user-owned rows
CREATE POLICY pings_delete_own ON public.thinking_pings
  FOR DELETE TO authenticated
  USING (from_user_id = auth.uid());

CREATE POLICY trail_points_delete_own ON public.trail_points
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 2) Restrict invite_code exposure: only the space creator can read the spaces row
DROP POLICY IF EXISTS spaces_select_member ON public.spaces;
CREATE POLICY spaces_select_creator ON public.spaces
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- 3) Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon.
--    Keep EXECUTE for authenticated where the function is referenced by RLS or RPC.
REVOKE EXECUTE ON FUNCTION public.my_space_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.space_member_count(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_space_by_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.my_space_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_member_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_space_by_code(text) TO authenticated;
-- handle_new_user is a trigger function; no role needs EXECUTE.

-- 4) Storage: drop any permissive listing policies and add owner-scoped ones.
--    Public direct-URL reads continue to work because the bucket itself is public.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view" ON storage.objects;

DROP POLICY IF EXISTS "profile_photos_owner_select" ON storage.objects;
CREATE POLICY "profile_photos_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'profile-photos' AND owner = auth.uid());

DROP POLICY IF EXISTS "profile_photos_owner_write" ON storage.objects;
CREATE POLICY "profile_photos_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos' AND owner = auth.uid()
              AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "profile_photos_owner_update" ON storage.objects;
CREATE POLICY "profile_photos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-photos' AND owner = auth.uid());

DROP POLICY IF EXISTS "profile_photos_owner_delete" ON storage.objects;
CREATE POLICY "profile_photos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-photos' AND owner = auth.uid());

DROP POLICY IF EXISTS "moments_media_owner_select" ON storage.objects;
CREATE POLICY "moments_media_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'moments-media' AND owner = auth.uid());

DROP POLICY IF EXISTS "moments_media_owner_write" ON storage.objects;
CREATE POLICY "moments_media_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'moments-media' AND owner = auth.uid()
              AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "moments_media_owner_update" ON storage.objects;
CREATE POLICY "moments_media_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'moments-media' AND owner = auth.uid());

DROP POLICY IF EXISTS "moments_media_owner_delete" ON storage.objects;
CREATE POLICY "moments_media_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'moments-media' AND owner = auth.uid());
