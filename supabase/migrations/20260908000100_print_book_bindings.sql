-- Preparation/quote only. Apply separately after review; not wired to build migration.
-- Only trusted operators/service-role may provision verified mappings. No browser writes.
begin;
create table public.print_book_bindings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'live')),
  provider_book_uid text not null check (provider_book_uid ~ '^[A-Za-z0-9_-]{1,100}$'),
  book_spec_uid text not null check (book_spec_uid ~ '^[A-Za-z0-9_-]{1,100}$'),
  page_count integer not null check (page_count > 0),
  trim_width_mm numeric not null check (trim_width_mm > 0),
  trim_height_mm numeric not null check (trim_height_mm > 0),
  bleed_mm numeric not null check (bleed_mm >= 0),
  binding_type text not null,
  cover_type text not null,
  source_updated_at timestamptz not null,
  inner_pdf_sha256 text check (inner_pdf_sha256 ~ '^[a-f0-9]{64}$'),
  cover_pdf_sha256 text check (cover_pdf_sha256 ~ '^[a-f0-9]{64}$'),
  finalized boolean not null default false,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, book_id, environment),
  unique (environment, provider_book_uid),
  check (not finalized or (finalized_at is not null and inner_pdf_sha256 is not null and cover_pdf_sha256 is not null))
);
alter table public.print_book_bindings enable row level security;
alter table public.print_book_bindings force row level security;
revoke all on public.print_book_bindings from public, anon, authenticated;
grant select on public.print_book_bindings to authenticated;
grant all on public.print_book_bindings to service_role;
create policy print_bindings_owned_read on public.print_book_bindings
  for select to authenticated using (
    auth.uid() = user_id and exists (
      select 1 from public.books b
      where b.id = book_id and b.user_id = auth.uid() and b.status = 'completed'
    )
  );
comment on table public.print_book_bindings is 'Operator-verified print preparation only; not payment entitlement, order ledger or fulfillment.';
commit;
