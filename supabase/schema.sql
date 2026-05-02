create extension if not exists pgcrypto;

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  email text not null unique,
  role text not null check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id text primary key,
  exam_id uuid references public.exams(id),
  exam text not null,
  source_exam text,
  year integer,
  paper text,
  paper_file text,
  question_number text,
  subject text,
  topic text,
  subtopic text,
  difficulty text,
  question_type text,
  status text not null default 'draft',
  language text not null default 'English',
  tags text[] not null default '{}',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.questions add column if not exists exam_id uuid references public.exams(id);
alter table public.questions add column if not exists updated_by uuid references public.profiles(id);

create index if not exists questions_exam_year_idx on public.questions (exam, year desc);
create index if not exists questions_exam_id_idx on public.questions (exam_id);
create index if not exists questions_subject_topic_idx on public.questions (subject, topic);
create index if not exists questions_status_idx on public.questions (status);
create index if not exists questions_payload_gin_idx on public.questions using gin (payload);

insert into storage.buckets (id, name, public)
values ('question-assets', 'question-assets', true)
on conflict (id) do update set public = excluded.public;

alter table public.questions enable row level security;
alter table public.exams enable row level security;
alter table public.profiles enable row level security;

insert into public.exams (name, slug, description)
values ('JEE Advanced', 'jee-advanced', 'Joint Entrance Examination Advanced')
on conflict (slug) do nothing;

drop policy if exists "Public can read published question payloads" on public.questions;
create policy "Public can read published question payloads"
on public.questions
for select
using (status in ('reviewed', 'published-ready'));

drop policy if exists "Service role can manage questions" on public.questions;
create policy "Service role can manage questions"
on public.questions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Public can read active exams" on public.exams;
create policy "Public can read active exams"
on public.exams
for select
using (is_active = true);

drop policy if exists "Service role can manage exams" on public.exams;
create policy "Service role can manage exams"
on public.exams
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Service role can manage profiles" on public.profiles;
create policy "Service role can manage profiles"
on public.profiles
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
