-- Add is_morning column to weight_entries
alter table public.weight_entries
  add column if not exists is_morning boolean not null default false;
