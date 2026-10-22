-- Run in Supabase Dashboard > SQL Editor after the media app's assignment-4.sql.
-- Adds database-enforced superadmin access for the separate admin app.

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- Prevent regular users from changing their own privilege flag.
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, avatar_url, updated_at) on public.profiles to authenticated;

create or replace function public.is_current_user_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_superadmin is true
  );
$$;
revoke all on function public.is_current_user_superadmin() from public, anon;
grant execute on function public.is_current_user_superadmin() to authenticated;

drop policy if exists "Superadmins can read all profiles" on public.profiles;
create policy "Superadmins can read all profiles"
  on public.profiles for select to authenticated
  using ((select public.is_current_user_superadmin()));

-- Existing assignment-4 grants the vote columns needed by the dashboard.
drop policy if exists "Superadmins can read all votes" on public.caption_votes;
create policy "Superadmins can read all votes"
  on public.caption_votes for select to authenticated
  using ((select public.is_current_user_superadmin()));

-- Keep only the explicit detail columns granted by assignment-4.sql.
drop policy if exists "Superadmins can read all generation details" on public.caption_generation_details;
create policy "Superadmins can read all generation details"
  on public.caption_generation_details for select to authenticated
  using ((select public.is_current_user_superadmin()));

-- Keep public feed reads intact; grant authenticated admins the columns and
-- policies needed to manage media through the server-side Supabase client.
-- Keep the feed's column-level grant; do not expose caption owner IDs to every
-- authenticated member just to render the superadmin-only dashboard.
grant insert (user_id, image_path, humor_style, caption_text) on public.caption_generations to authenticated;
grant update (image_path, humor_style, caption_text) on public.caption_generations to authenticated;
grant delete on public.caption_generations to authenticated;

drop policy if exists "Superadmins can create media" on public.caption_generations;
create policy "Superadmins can create media"
  on public.caption_generations for insert to authenticated
  with check ((select public.is_current_user_superadmin()));

drop policy if exists "Superadmins can update media" on public.caption_generations;
create policy "Superadmins can update media"
  on public.caption_generations for update to authenticated
  using ((select public.is_current_user_superadmin()))
  with check ((select public.is_current_user_superadmin()));

drop policy if exists "Superadmins can delete media" on public.caption_generations;
create policy "Superadmins can delete media"
  on public.caption_generations for delete to authenticated
  using ((select public.is_current_user_superadmin()));

-- BOOTSTRAP (run separately after the migration):
-- 1. Deploy the app and sign in once with Google, creating your profile.
-- 2. Copy your user UUID from Supabase Dashboard > Authentication > Users.
-- 3. Replace the placeholder, then run this as the database owner:
-- update public.profiles set is_superadmin = true where id = 'YOUR_AUTH_USER_UUID';
