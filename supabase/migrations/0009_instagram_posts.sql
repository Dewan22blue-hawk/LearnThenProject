-- OutputLab 0009 — Laporan Performa Instagram (Lap. IG)
-- Tabel penyimpanan metrik postingan Instagram hasil impor Meta Business Suite CSV atau input manual.

create table if not exists public.instagram_posts (
  post_id varchar(64) not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id varchar(64),
  username varchar(100),
  account_name text,
  description text,
  duration_sec integer not null default 0,
  published_raw varchar(50),
  published_at timestamptz,
  permalink text,
  post_type varchar(50),
  data_comment text,
  date_preset varchar(50) default 'Sepanjang Masa',
  views integer not null default 0,
  reach integer not null default 0,
  likes integer not null default 0,
  shares integer not null default 0,
  follows integer not null default 0,
  comments integer not null default 0,
  saves integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

drop trigger if exists trg_instagram_posts_updated on public.instagram_posts;
create trigger trg_instagram_posts_updated
  before update on public.instagram_posts
  for each row execute function public.handle_updated_at();

create index if not exists idx_instagram_posts_user_published
  on public.instagram_posts(user_id, published_at desc);
create index if not exists idx_instagram_posts_username
  on public.instagram_posts(user_id, username);
create index if not exists idx_instagram_posts_post_type
  on public.instagram_posts(user_id, post_type);

alter table public.instagram_posts enable row level security;

drop policy if exists "instagram_posts_owner_all" on public.instagram_posts;
create policy "instagram_posts_owner_all" on public.instagram_posts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
