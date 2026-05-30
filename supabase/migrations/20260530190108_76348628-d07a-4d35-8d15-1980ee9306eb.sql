DROP POLICY IF EXISTS spaces_select_member ON public.spaces;
CREATE POLICY spaces_select_member ON public.spaces
  FOR SELECT TO authenticated
  USING (id = my_space_id() OR created_by = auth.uid());