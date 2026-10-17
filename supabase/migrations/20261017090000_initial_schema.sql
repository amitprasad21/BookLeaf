-- BookLeaf initial schema (task DB-2).
-- Source of truth: .back/DATA_MODEL.md. Enum values must match packages/shared
-- and openapi.yaml (enforced by backend/test/schema-contract.test.ts).
--
-- Security: row level security is ENABLED on every table here with NO policies,
-- so client roles (anon, authenticated) can read or write nothing until the
-- DB-3 policies are added. The anon role also loses all table grants.
-- Rollback: supabase/rollback/20261017090000_initial_schema_down.sql

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('author', 'admin');
create type public.ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.ticket_category as enum (
  'royalty_payments',
  'isbn_metadata',
  'printing_quality',
  'distribution_availability',
  'book_status_production',
  'general_inquiry'
);
create type public.ticket_priority as enum ('critical', 'high', 'medium', 'low');
create type public.ai_status as enum ('pending', 'completed', 'failed', 'manual_review_required');
create type public.value_source as enum ('ai', 'admin');
create type public.message_sender as enum ('author', 'admin');
create type public.draft_status as enum ('ready', 'superseded');

-- ---------------------------------------------------------------------------
-- 2. Catalogue: seeded from the assessment dataset, read-only in the app
-- ---------------------------------------------------------------------------
create table public.authors (
  author_id   text primary key check (author_id ~ '^AUTH[0-9]{3,}$'),
  name        text not null check (char_length(btrim(name)) > 0),
  email       text not null,
  phone       text,
  city        text,
  joined_date date not null,
  created_at  timestamptz not null default now()
);
create unique index authors_email_lower_key on public.authors (lower(email));
comment on table public.authors is 'Authors from the assessment dataset. Read-only in the app.';

create table public.books (
  book_id                  text primary key,
  author_id                text not null references public.authors (author_id) on delete restrict,
  title                    text not null,
  isbn                     text not null unique,  -- stored as provided (placeholder format); never checksum-validated
  genre                    text not null,
  publication_date         date,                  -- null while in production
  status                   text not null,
  mrp                      numeric(10, 2) check (mrp >= 0),
  author_royalty_per_copy  numeric(10, 2) check (author_royalty_per_copy >= 0),
  total_copies_sold        integer not null default 0 check (total_copies_sold >= 0),
  total_royalty_earned     numeric(12, 2) not null default 0 check (total_royalty_earned >= 0),
  royalty_paid             numeric(12, 2) not null default 0 check (royalty_paid >= 0),
  royalty_pending          numeric(12, 2) not null default 0 check (royalty_pending >= 0),
  last_royalty_payout_date date,
  print_partner            text,
  available_on             text[] not null default '{}',
  created_at               timestamptz not null default now(),
  constraint books_status_check check (
    status = 'Published & Live' or status = 'Manuscript Received' or status ~ '^In Production - .+$'
  ),
  constraint books_royalty_balance_check check (royalty_paid + royalty_pending = total_royalty_earned),
  -- Target of the tickets composite FK: a ticket's book must belong to the ticket's author.
  constraint books_book_author_key unique (book_id, author_id)
);
create index books_author_id_idx on public.books (author_id);
comment on table public.books is 'Books from the assessment dataset. Royalty figures are read-only in the app.';

-- ---------------------------------------------------------------------------
-- 3. Identity: one profile per Supabase Auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.user_role not null,
  author_id    text unique references public.authors (author_id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) > 0),
  created_at   timestamptz not null default now(),
  constraint profiles_role_author_check check (
    (role = 'author' and author_id is not null) or (role = 'admin' and author_id is null)
  )
);
comment on table public.profiles is 'Role and author link per auth user. The backend derives identity from here, never from requests.';

-- ---------------------------------------------------------------------------
-- 4. Tickets
-- ---------------------------------------------------------------------------
create table public.tickets (
  id                uuid primary key default gen_random_uuid(),
  reference_no      bigint not null generated always as identity (start with 1001) unique,
  reference         text not null generated always as ('BL-' || reference_no::text) stored,
  author_id         text not null references public.authors (author_id) on delete restrict,
  book_id           text,  -- null = "General / Account Level"
  subject           text not null check (char_length(btrim(subject)) between 5 and 150),
  description       text not null check (char_length(btrim(description)) between 20 and 5000),
  attachment_name   text check (char_length(attachment_name) <= 255),

  status            public.ticket_status not null default 'open',
  category          public.ticket_category,
  category_source   public.value_source,
  priority          public.ticket_priority,
  priority_source   public.value_source,

  -- Raw AI suggestions are kept even after an admin override.
  ai_status         public.ai_status not null default 'pending',
  ai_category       public.ticket_category,
  ai_priority       public.ticket_priority,
  ai_confidence     numeric(3, 2) check (ai_confidence between 0 and 1),
  ai_signals        text[] not null default '{}',
  ai_rationale      text check (char_length(ai_rationale) <= 300),
  ai_policy_floor   text,
  ai_attempts       smallint not null default 0 check (ai_attempts >= 0),
  ai_failure_reason text check (
    ai_failure_reason in (
      'not_configured',
      'provider_unavailable',
      'circuit_open',
      'budget_exhausted',
      'invalid_output',
      'refused'
    )
  ),
  ai_prompt_version text,
  ai_processed_at   timestamptz,

  assigned_admin_id uuid references public.profiles (id) on delete set null,
  version           integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  first_response_at timestamptz,
  resolved_at       timestamptz,
  closed_at         timestamptz,

  -- MATCH SIMPLE: not checked when book_id is null (general tickets).
  constraint tickets_book_belongs_to_author_fkey
    foreign key (book_id, author_id) references public.books (book_id, author_id) on delete restrict,
  constraint tickets_category_source_check check ((category is null) = (category_source is null)),
  constraint tickets_priority_source_check check ((priority is null) = (priority_source is null))
);
create index tickets_author_updated_idx on public.tickets (author_id, updated_at desc);
create index tickets_author_created_idx on public.tickets (author_id, created_at desc);
create index tickets_queue_idx on public.tickets (status, priority, created_at);
create index tickets_assigned_admin_idx on public.tickets (assigned_admin_id);
create index tickets_book_idx on public.tickets (book_id);
create index tickets_ai_retry_idx on public.tickets (created_at) where ai_status in ('pending', 'failed');
comment on table public.tickets is 'Support tickets. Saved before any AI processing; ai_* columns hold suggestions only.';

-- ---------------------------------------------------------------------------
-- 5. AI drafts (admin-only)
-- ---------------------------------------------------------------------------
create table public.ai_drafts (
  id                  uuid primary key default gen_random_uuid(),
  ticket_id           uuid not null references public.tickets (id) on delete cascade,
  status              public.draft_status not null default 'ready',
  reply               text not null check (char_length(reply) between 1 and 5000),
  kb_sections_used    text[] not null default '{}',
  needs_escalation    boolean not null default false,
  escalation_team     text not null default 'none' check (
    escalation_team in ('none', 'finance', 'production', 'distribution', 'printing', 'support_lead')
  ),
  internal_checklist  text[] not null default '{}',
  missing_information text[] not null default '{}',
  fact_warnings       text[] not null default '{}',
  context_hash        text not null,
  prompt_version      text not null,
  provider            text not null,
  model               text not null,
  input_tokens        integer check (input_tokens >= 0),
  output_tokens       integer check (output_tokens >= 0),
  requested_by        uuid not null references public.profiles (id) on delete restrict,
  created_at          timestamptz not null default now()
);
create index ai_drafts_ticket_idx on public.ai_drafts (ticket_id, created_at desc);
create index ai_drafts_reuse_idx on public.ai_drafts (ticket_id, context_hash) where status = 'ready';
comment on table public.ai_drafts is 'AI reply drafts. Never sent automatically; only the admin-sent text reaches authors.';

-- ---------------------------------------------------------------------------
-- 6. Thread messages (author-visible) and internal notes (admin-only)
-- ---------------------------------------------------------------------------
create table public.ticket_messages (
  id                uuid primary key default gen_random_uuid(),
  ticket_id         uuid not null references public.tickets (id) on delete cascade,
  sender_role       public.message_sender not null,
  sender_profile_id uuid not null references public.profiles (id) on delete restrict,
  body              text not null check (char_length(btrim(body)) between 1 and 5000),
  ai_draft_id       uuid references public.ai_drafts (id) on delete set null,
  created_at        timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);
comment on table public.ticket_messages is 'Author-visible thread. The original description lives on tickets. Append-only.';

create table public.internal_notes (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references public.tickets (id) on delete cascade,
  admin_profile_id uuid not null references public.profiles (id) on delete restrict,
  body             text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at       timestamptz not null default now()
);
create index internal_notes_ticket_idx on public.internal_notes (ticket_id, created_at);
comment on table public.internal_notes is 'Admin-only notes. Never returned to authors, never sent to an LLM.';

-- ---------------------------------------------------------------------------
-- 7. Append-only logs, written only by the backend system writer
-- ---------------------------------------------------------------------------
create table public.audit_events (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid references public.tickets (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id) on delete set null,  -- null = system / AI
  action           text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  metadata         jsonb not null default '{}'::jsonb,  -- old/new values and ids only, never message bodies
  created_at       timestamptz not null default now()
);
create index audit_events_ticket_idx on public.audit_events (ticket_id, created_at);
comment on table public.audit_events is 'Admin and system actions for the ticket timeline. Append-only.';

create table public.ai_usage_events (
  id                 uuid primary key default gen_random_uuid(),
  ticket_id          uuid references public.tickets (id) on delete set null,
  task               text not null check (task in ('triage', 'draft')),
  provider           text not null,
  model              text not null,
  prompt_version     text,
  outcome            text not null check (
    outcome in (
      'success',
      'invalid_output',
      'refused',
      'timeout',
      'rate_limited',
      'provider_error',
      'auth_error',
      'budget_blocked',
      'circuit_open',
      'not_configured'
    )
  ),
  input_tokens       integer not null default 0 check (input_tokens >= 0),
  output_tokens      integer not null default 0 check (output_tokens >= 0),
  cache_read_tokens  integer not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  latency_ms         integer check (latency_ms >= 0),
  estimated_cost_usd numeric(10, 6) check (estimated_cost_usd >= 0),
  created_at         timestamptz not null default now()
);
create index ai_usage_events_created_idx on public.ai_usage_events (created_at);
comment on table public.ai_usage_events is 'Per-call AI accounting for budgets and cost reporting. No ticket text. Append-only.';

-- ---------------------------------------------------------------------------
-- 8. Triggers
-- ---------------------------------------------------------------------------

-- Ticket content and ownership are fixed at creation.
create function public.tickets_guard_immutable_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.author_id is distinct from old.author_id
     or new.book_id is distinct from old.book_id
     or new.subject is distinct from old.subject
     or new.description is distinct from old.description
     or new.attachment_name is distinct from old.attachment_name
     or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'immutable_field',
      detail = 'author_id, book_id, subject, description, attachment_name and created_at cannot change after creation.';
  end if;
  return new;
end;
$$;

create trigger tickets_guard_immutable_fields
before update on public.tickets
for each row execute function public.tickets_guard_immutable_fields();

-- Every change bumps updated_at and the optimistic-locking version.
create function public.tickets_set_updated_at_and_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger tickets_set_updated_at_and_version
before update on public.tickets
for each row execute function public.tickets_set_updated_at_and_version();

-- Backstop rate limit (the API limits first). Also covers anyone calling the
-- Data API directly with the public key and their own JWT. Runs as the
-- inserting user, so under RLS it counts only that author's own tickets.
create function public.tickets_author_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  last_10_minutes integer;
  last_24_hours   integer;
begin
  select count(*) filter (where t.created_at > now() - interval '10 minutes'),
         count(*)
    into last_10_minutes, last_24_hours
    from public.tickets as t
   where t.author_id = new.author_id
     and t.created_at > now() - interval '24 hours';

  if last_10_minutes >= 5 or last_24_hours >= 20 then
    raise exception using
      errcode = 'P0001',
      message = 'rate_limited',
      detail = 'At most 5 tickets per 10 minutes and 20 per 24 hours per author.';
  end if;
  return new;
end;
$$;

create trigger tickets_author_rate_limit
before insert on public.tickets
for each row execute function public.tickets_author_rate_limit();

-- A new thread message marks its ticket as updated (so lists re-sort and the
-- version check sees the change). SECURITY DEFINER because authors may insert
-- follow-ups but are not allowed to update tickets under RLS; the function
-- only touches updated_at of the message's own ticket.
create function public.ticket_messages_touch_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tickets set updated_at = now() where id = new.ticket_id;
  return null;
end;
$$;

create trigger ticket_messages_touch_ticket
after insert on public.ticket_messages
for each row execute function public.ticket_messages_touch_ticket();

-- ---------------------------------------------------------------------------
-- 9. Lock down: RLS on everywhere (policies arrive in DB-3), nothing for anon
-- ---------------------------------------------------------------------------
alter table public.authors         enable row level security;
alter table public.books           enable row level security;
alter table public.profiles        enable row level security;
alter table public.tickets         enable row level security;
alter table public.ai_drafts       enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.internal_notes  enable row level security;
alter table public.audit_events    enable row level security;
alter table public.ai_usage_events enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
