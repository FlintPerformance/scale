-- Profiles table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles" on public.profiles
  for select using (true);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Weight entries
create table if not exists public.weight_entries (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  weight numeric(6,2) not null,
  unit text not null default 'lb',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_weight_entries_user_date on public.weight_entries(user_id, date desc);

alter table public.weight_entries enable row level security;

-- Users can manage their own entries
create policy "Users can manage own weight entries" on public.weight_entries
  for all using (auth.uid() = user_id);

-- Circle members can view each other's weight entries
create policy "Circle members can view shared entries" on public.weight_entries
  for select using (
    user_id in (
      select cm2.user_id from public.circle_members cm1
      join public.circle_members cm2 on cm1.circle_id = cm2.circle_id
      where cm1.user_id = auth.uid()
    )
  );

-- Goals
create table if not exists public.goals (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  target_weight numeric(6,2) not null,
  target_date date,
  start_weight numeric(6,2) not null,
  start_date date not null,
  unit text not null default 'lb',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.goals enable row level security;

create policy "Users can manage own goals" on public.goals
  for all using (auth.uid() = user_id);

-- Circles (accountability groups)
create table if not exists public.circles (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  invite_code text unique not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.circles enable row level security;

create policy "Circle members can view their circles" on public.circles
  for select using (
    id in (select circle_id from public.circle_members where user_id = auth.uid())
  );

create policy "Authenticated users can create circles" on public.circles
  for insert with check (auth.uid() = created_by);

-- Allow anyone to look up a circle by invite code (for joining)
create policy "Anyone can lookup circle by invite code" on public.circles
  for select using (true);

-- Circle members
create table if not exists public.circle_members (
  id uuid default gen_random_uuid() primary key,
  circle_id uuid references public.circles(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member',
  joined_at timestamptz default now(),
  unique(circle_id, user_id)
);

create index idx_circle_members_user on public.circle_members(user_id);
create index idx_circle_members_circle on public.circle_members(circle_id);

alter table public.circle_members enable row level security;

create policy "Users can view members of their circles" on public.circle_members
  for select using (
    circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
  );

create policy "Users can join circles" on public.circle_members
  for insert with check (auth.uid() = user_id);

create policy "Users can leave circles" on public.circle_members
  for delete using (auth.uid() = user_id);

-- Cheers (reactions on weight entries)
create table if not exists public.cheers (
  id uuid default gen_random_uuid() primary key,
  entry_id text references public.weight_entries(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(entry_id, user_id)
);

alter table public.cheers enable row level security;

create policy "Circle members can view cheers" on public.cheers
  for select using (true);

create policy "Users can add cheers" on public.cheers
  for insert with check (auth.uid() = user_id);

create policy "Users can remove own cheers" on public.cheers
  for delete using (auth.uid() = user_id);
