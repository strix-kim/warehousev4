begin;

drop policy if exists equipment_lists_delete_for_admins
  on public.equipment_lists;

drop policy if exists equipment_lists_delete_for_owners_and_admins
  on public.equipment_lists;

create policy equipment_lists_delete_for_owners_and_admins
  on public.equipment_lists
  for delete
  to authenticated
  using (
    (select private.has_any_role(array['admin']::text[]))
    or (
      (select private.is_app_member())
      and created_by = (select auth.uid())
      and reservation_status = 'draft'
    )
  );

comment on policy equipment_lists_delete_for_owners_and_admins
  on public.equipment_lists is
  'Admins may delete any list. Application members may delete only their own drafts.';

commit;
