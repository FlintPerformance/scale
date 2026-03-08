-- Add emoji column to cheers table for reaction support
alter table public.cheers add column if not exists emoji text not null default '🔥';

-- Drop the old unique constraint (entry_id, user_id) and replace with (entry_id, user_id, emoji)
-- so users can react with multiple different emojis per entry
alter table public.cheers drop constraint if exists cheers_entry_id_user_id_key;
alter table public.cheers add constraint cheers_entry_id_user_id_emoji_key unique (entry_id, user_id, emoji);
