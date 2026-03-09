-- Add graph_color column to profiles for circle comparison chart
alter table public.profiles add column if not exists graph_color text not null default '#f04a0e';
