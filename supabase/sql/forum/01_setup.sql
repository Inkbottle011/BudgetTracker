-- Forum: suggestions and problems, shared with everyone who uses the app (Settings -> Suggestions forum).
-- Safe to run more than once. Applied automatically on merge (scripts/apply-database-setup.mjs).
--
-- Everyone signed in can read every post and reply, post, reply and upvote. People appear
-- anonymously in the app ("Member 4F3A"). Authors can edit their own posts and replies and delete
-- them (a delete only hides it, so it can be undone). Moderators set a post's status
-- (planned / done / not planned) and hide posts or replies; their posts and replies are marked.
--
-- To make someone a moderator: Supabase -> Authentication -> Users, copy their user ID, then
-- Table Editor -> forum_moderators -> Insert row -> paste it into user_id -> Save.

-- ---- Moderators -------------------------------------------------------------------------------

create table if not exists public.forum_moderators (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
revoke all on public.forum_moderators from anon, authenticated;
grant select on public.forum_moderators to authenticated;
grant all on public.forum_moderators to service_role;
alter table public.forum_moderators enable row level security;
drop policy if exists "You can see whether you are a moderator" on public.forum_moderators;
create policy "You can see whether you are a moderator"
  on public.forum_moderators for select to authenticated
  using (user_id = (select auth.uid()));

-- Whether the signed-in person is a moderator (reads the list past its privacy rule, nothing else)
create or replace function public.is_forum_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.forum_moderators where user_id = auth.uid())
$$;
revoke execute on function public.is_forum_moderator() from public, anon;
grant execute on function public.is_forum_moderator() to authenticated, service_role;

-- ---- Posts --------------------------------------------------------------------------------------

create table if not exists public.forum_posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind          text not null default 'idea' check (kind in ('idea', 'problem', 'other')),
  title         text not null check (length(btrim(title)) between 1 and 120),
  body          text not null default '' check (length(body) <= 2000),
  status        text not null default 'open' check (status in ('open', 'planned', 'done', 'wont_do')),
  hidden        boolean not null default false,     -- by a moderator
  by_moderator  boolean not null default false,     -- set automatically
  deleted_at    timestamptz,                        -- by its author; cleared again by Undo
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists forum_posts_created_at_idx on public.forum_posts (created_at desc);
create index if not exists forum_posts_user_id_idx on public.forum_posts (user_id);

-- ---- Replies -------------------------------------------------------------------------------------

create table if not exists public.forum_replies (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.forum_posts (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body          text not null check (length(btrim(body)) between 1 and 2000),
  hidden        boolean not null default false,
  by_moderator  boolean not null default false,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists forum_replies_post_id_idx on public.forum_replies (post_id, created_at);
create index if not exists forum_replies_user_id_idx on public.forum_replies (user_id);

-- ---- Upvotes (one per person per post) -----------------------------------------------------------

create table if not exists public.forum_votes (
  post_id     uuid not null references public.forum_posts (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists forum_votes_user_id_idx on public.forum_votes (user_id);

-- ---- Who can do what ------------------------------------------------------------------------------
-- New tables are open to everyone by default on Supabase, so start from nothing and grant only
-- what's needed. Authors may change only the text and the deleted mark; status and hidden change
-- only through the moderator functions below.

revoke all on public.forum_posts, public.forum_replies, public.forum_votes from anon, authenticated;
grant select, insert on public.forum_posts, public.forum_replies to authenticated;
grant update (kind, title, body, deleted_at) on public.forum_posts to authenticated;
grant update (body, deleted_at) on public.forum_replies to authenticated;
grant select, insert, delete on public.forum_votes to authenticated;
grant all on public.forum_posts, public.forum_replies, public.forum_votes to service_role;

alter table public.forum_posts enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_votes enable row level security;

drop policy if exists "Everyone signed in reads the forum" on public.forum_posts;
create policy "Everyone signed in reads the forum"
  on public.forum_posts for select to authenticated
  using ((deleted_at is null and not hidden) or user_id = (select auth.uid()) or (select public.is_forum_moderator()));

drop policy if exists "You post as yourself" on public.forum_posts;
create policy "You post as yourself"
  on public.forum_posts for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and not hidden and deleted_at is null);

drop policy if exists "You edit your own posts" on public.forum_posts;
create policy "You edit your own posts"
  on public.forum_posts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Everyone signed in reads replies" on public.forum_replies;
create policy "Everyone signed in reads replies"
  on public.forum_replies for select to authenticated
  using ((deleted_at is null and not hidden) or user_id = (select auth.uid()) or (select public.is_forum_moderator()));

drop policy if exists "You reply as yourself" on public.forum_replies;
create policy "You reply as yourself"
  on public.forum_replies for insert to authenticated
  with check (user_id = (select auth.uid()) and not hidden and deleted_at is null);

drop policy if exists "You edit your own replies" on public.forum_replies;
create policy "You edit your own replies"
  on public.forum_replies for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Everyone signed in sees upvotes" on public.forum_votes;
create policy "Everyone signed in sees upvotes"
  on public.forum_votes for select to authenticated using (true);

drop policy if exists "You upvote as yourself" on public.forum_votes;
create policy "You upvote as yourself"
  on public.forum_votes for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "You take back your own upvote" on public.forum_votes;
create policy "You take back your own upvote"
  on public.forum_votes for delete to authenticated using (user_id = (select auth.uid()));

-- ---- Automatic: moderator mark, last edited ------------------------------------------------------

create or replace function public.forum_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.by_moderator := public.is_forum_moderator();
  else
    new.by_moderator := old.by_moderator;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists forum_posts_before_write on public.forum_posts;
create trigger forum_posts_before_write before insert or update on public.forum_posts
  for each row execute function public.forum_before_write();
drop trigger if exists forum_replies_before_write on public.forum_replies;
create trigger forum_replies_before_write before insert or update on public.forum_replies
  for each row execute function public.forum_before_write();

-- ---- Moderator tools ------------------------------------------------------------------------------

create or replace function public.moderate_post(p_id uuid, p_status text, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_forum_moderator() then
    raise exception 'Only moderators can do that' using errcode = '42501';
  end if;
  update public.forum_posts set status = p_status, hidden = p_hidden, updated_at = now() where id = p_id;
end $$;

create or replace function public.moderate_reply(p_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_forum_moderator() then
    raise exception 'Only moderators can do that' using errcode = '42501';
  end if;
  update public.forum_replies set hidden = p_hidden, updated_at = now() where id = p_id;
end $$;

revoke execute on function public.moderate_post(uuid, text, boolean), public.moderate_reply(uuid, boolean) from public, anon;
grant execute on function public.moderate_post(uuid, text, boolean), public.moderate_reply(uuid, boolean) to authenticated;
