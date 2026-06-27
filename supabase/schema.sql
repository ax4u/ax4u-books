-- AX4U Books — Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db push`) after creating a
-- project. See SETUP.md for full instructions.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- books
-- ---------------------------------------------------------------------------
create table if not exists public.books (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  topic       text not null,
  title       text,
  options     jsonb not null default '{}'::jsonb,
  status      text not null default 'draft'
                check (status in ('draft','paid','generating','completed','failed')),
  pages       jsonb not null default '[]'::jsonb,
  checkout_id text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists books_user_id_idx on public.books (user_id);
create index if not exists books_checkout_id_idx on public.books (checkout_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: users can only see/manage their own books.
-- The service-role key (used by the Polar webhook + generation job) bypasses
-- RLS automatically, so no policy is needed for it.
-- ---------------------------------------------------------------------------
alter table public.books enable row level security;

drop policy if exists "books_select_own" on public.books;
create policy "books_select_own" on public.books
  for select using (auth.uid() = user_id);

drop policy if exists "books_insert_own" on public.books;
create policy "books_insert_own" on public.books
  for insert with check (auth.uid() = user_id);

drop policy if exists "books_update_own" on public.books;
create policy "books_update_own" on public.books
  for update using (auth.uid() = user_id);

drop policy if exists "books_delete_own" on public.books;
create policy "books_delete_own" on public.books
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket for generated assets (illustrations + final PDFs).
-- Private bucket; the app serves files through its own authenticated routes.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('book-assets', 'book-assets', false)
on conflict (id) do nothing;
