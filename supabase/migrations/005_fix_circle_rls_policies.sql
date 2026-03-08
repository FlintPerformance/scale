-- Fix self-referencing RLS policy on circle_members.
-- The old policy queried circle_members inside its own SELECT policy,
-- creating a circular dependency where no rows were ever visible.

-- Helper function that bypasses RLS to get a user's circle IDs
create or replace function public.get_user_circle_ids(uid uuid)
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select circle_id from public.circle_members where user_id = uid;
$$;

-- Drop the broken self-referencing policy
drop policy if exists "Users can view members of their circles" on public.circle_members;

-- Recreate using the SECURITY DEFINER function
create policy "Users can view members of their circles" on public.circle_members
  for select using (
    circle_id in (select public.get_user_circle_ids(auth.uid()))
  );

-- Also fix the weight_entries policy that references circle_members
drop policy if exists "Circle members can view shared entries" on public.weight_entries;

create policy "Circle members can view shared entries" on public.weight_entries
  for select using (
    user_id in (
      select cm.user_id
      from public.circle_members cm
      where cm.circle_id in (select public.get_user_circle_ids(auth.uid()))
    )
  );
