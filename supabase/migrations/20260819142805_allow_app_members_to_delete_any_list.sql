begin;

drop policy if exists equipment_lists_delete_for_admins
  on public.equipment_lists;

drop policy if exists equipment_lists_delete_for_owners_and_admins
  on public.equipment_lists;

drop policy if exists equipment_lists_delete_for_app_members
  on public.equipment_lists;

drop policy if exists equipment_lists_delete_for_default_account
  on public.equipment_lists;

create policy equipment_lists_delete_for_default_account
  on public.equipment_lists
  for delete
  to authenticated
  using (
    (select private.is_app_member())
    and (select auth.jwt()) ->> 'email' = 'argo@argomedia.uz'
  );

comment on policy equipment_lists_delete_for_default_account
  on public.equipment_lists is
  'The default ARGO account may delete any equipment list regardless of owner or status.';

commit;
