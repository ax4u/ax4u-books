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
  cover_image_path text,
  pdf_path    text,
  checkout_id text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.books add column if not exists cover_image_path text;
alter table public.books add column if not exists pdf_path text;

create index if not exists books_user_id_idx on public.books (user_id);
create index if not exists books_user_created_at_idx
  on public.books (user_id, created_at desc);
create index if not exists books_checkout_id_idx on public.books (checkout_id);

create or replace function public.mark_book_page_image_stored(
  p_book_id uuid,
  p_page_index integer,
  p_image_path text,
  p_image_mime text,
  p_image_width integer,
  p_image_height integer,
  p_image_bytes integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_first_image_index integer;
begin
  select min(coalesce((page->>'index')::integer, ordinality::integer - 1))
  into v_first_image_index
  from public.books b,
       jsonb_array_elements(b.pages) with ordinality as elem(page, ordinality)
  where b.id = p_book_id
    and (
      nullif(page->>'imagePath', '') is not null
      or nullif(page->>'image', '') is not null
    );

  update public.books b
  set pages = coalesce(
        (
          select jsonb_agg(
            case
              when coalesce((page->>'index')::integer, ordinality::integer - 1) = p_page_index
              then page - 'image' - 'imageAvailable' || jsonb_build_object(
                'image', null,
                'imagePath', p_image_path,
                'imageMime', p_image_mime,
                'imageWidth', p_image_width,
                'imageHeight', p_image_height,
                'imageBytes', p_image_bytes
              )
              else page
            end
            order by ordinality
          )
          from jsonb_array_elements(b.pages) with ordinality as elem(page, ordinality)
        ),
        '[]'::jsonb
      ),
      cover_image_path = case
        when b.cover_image_path is null and v_first_image_index = p_page_index
        then p_image_path
        else b.cover_image_path
      end,
      updated_at = now()
  where b.id = p_book_id;
end;
$$;

grant execute on function public.mark_book_page_image_stored(
  uuid,
  integer,
  text,
  text,
  integer,
  integer,
  integer
) to authenticated;

-- Keep cover thumbnails populated for rows created before cover_image_path.
update public.books
set cover_image_path = (
  select page->>'imagePath'
  from jsonb_array_elements(pages) as page
  where page ? 'imagePath'
    and nullif(page->>'imagePath', '') is not null
  order by coalesce((page->>'index')::int, 0)
  limit 1
)
where cover_image_path is null
  and pages <> '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- generation_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.generation_jobs (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('book','page')),
  page_index  integer,
  status      text not null default 'pending'
                check (status in ('pending','running','completed','failed')),
  attempts    integer not null default 0,
  max_attempts integer not null default 5,
  next_run_at timestamptz not null default now(),
  locked_at   timestamptz,
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists generation_jobs_due_idx
  on public.generation_jobs (status, next_run_at);
create index if not exists generation_jobs_book_idx
  on public.generation_jobs (book_id, status);
create unique index if not exists generation_jobs_active_book_once_idx
  on public.generation_jobs (book_id)
  where status in ('pending','running') and page_index is null;
create unique index if not exists generation_jobs_active_page_once_idx
  on public.generation_jobs (book_id, page_index)
  where status in ('pending','running') and page_index is not null;

alter table public.generation_jobs enable row level security;

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
