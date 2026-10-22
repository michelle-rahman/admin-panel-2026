# Humor Project Admin Studio

Private admin dashboard for the Humor Project Supabase database.

## Supabase setup

1. In the Supabase SQL Editor for the same project used by `humorproject2026-27`, run `supabase/admin-panel.sql` after the media app's `assignment-4.sql` migration.
2. Set these variables in Vercel for Production, Preview, and Development:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the same public anon/publishable key used by the media app)
   - `NEXT_PUBLIC_SITE_URL=https://admin-panel-2026-lime.vercel.app`
3. In Supabase Authentication > URL Configuration, add `https://admin-panel-2026-lime.vercel.app/auth/callback` to the allowed redirect URLs. The Google OAuth provider stays configured in the existing Supabase project.
4. Deploy, then sign in once with the Google account that should administer the project. The auth trigger in the media app creates a profile at login.
5. In Supabase Dashboard > Authentication > Users, copy your user UUID. In SQL Editor, run `update public.profiles set is_superadmin = true where id = 'YOUR_AUTH_USER_UUID';` after replacing the placeholder.

The first admin flag must be granted by a trusted database owner in SQL Editor. Google login by itself never grants admin access. Do not put a service-role key in Vercel or browser code.

## Environment variables

Copy `.env.example` to `.env.local` for local development and fill in the same public Supabase URL and anon/publishable key as the media app. The app uses the anon key with user sessions and database RLS; it does not require a service-role key.

## Features

- Overview cards for media, votes, upvote ratio, and profiles.
- Read profiles and individual upvote/downvote records.
- Create, read, update, and delete generated caption media.
- Google OAuth and server-side superadmin checks on the dashboard and all mutation actions.
- RLS migration that enforces the same admin boundary inside Supabase.
