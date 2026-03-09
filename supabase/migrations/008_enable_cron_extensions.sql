-- Enable pg_cron and pg_net extensions for server-side notification scheduling.
-- Prerequisites: enable these in Supabase Dashboard (Database > Extensions) first.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
