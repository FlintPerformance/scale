-- Predictions (prediction market style feature for circles)
create table if not exists public.predictions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  circle_id uuid references public.circles(id) on delete cascade not null,
  predicted_weight numeric(6,2) not null,
  start_weight numeric(6,2) not null,
  unit text not null default 'lb',
  deadline date not null,
  message text,
  status text not null default 'active', -- active, resolved
  result text, -- nails_it, overshoots, falls_short, crushes_it
  actual_weight numeric(6,2),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create index idx_predictions_circle on public.predictions(circle_id);
create index idx_predictions_user on public.predictions(user_id);
create index idx_predictions_status on public.predictions(status, deadline);

alter table public.predictions enable row level security;

-- Circle members can view predictions in their circles
create policy "Circle members can view predictions" on public.predictions
  for select using (
    circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
  );

-- Users can create predictions in circles they belong to
create policy "Users can create predictions" on public.predictions
  for insert with check (
    auth.uid() = user_id
    and circle_id in (select circle_id from public.circle_members where user_id = auth.uid())
  );

-- Users can update their own predictions (for resolution)
create policy "Users can update own predictions" on public.predictions
  for update using (auth.uid() = user_id);

-- Prediction votes (circle members weigh in)
create table if not exists public.prediction_votes (
  id uuid default gen_random_uuid() primary key,
  prediction_id uuid references public.predictions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  vote text not null, -- nails_it, overshoots, falls_short, crushes_it
  created_at timestamptz default now(),
  unique(prediction_id, user_id)
);

create index idx_prediction_votes_prediction on public.prediction_votes(prediction_id);

alter table public.prediction_votes enable row level security;

-- Circle members can view votes on predictions they can see
create policy "Circle members can view prediction votes" on public.prediction_votes
  for select using (
    prediction_id in (
      select id from public.predictions where circle_id in (
        select circle_id from public.circle_members where user_id = auth.uid()
      )
    )
  );

-- Users can vote on predictions
create policy "Users can vote on predictions" on public.prediction_votes
  for insert with check (auth.uid() = user_id);

-- Users can change their vote
create policy "Users can update own votes" on public.prediction_votes
  for update using (auth.uid() = user_id);

-- Users can remove their vote
create policy "Users can delete own votes" on public.prediction_votes
  for delete using (auth.uid() = user_id);
