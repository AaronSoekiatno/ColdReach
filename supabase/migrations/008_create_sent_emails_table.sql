-- Create sent_emails table to track email history
create table if not exists public.sent_emails (
  id uuid default gen_random_uuid() primary key,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  startup_id text not null references public.startups(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  subject text not null,
  body text not null,
  match_score numeric,
  sent_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null
);

-- Create index for faster queries by candidate
create index if not exists idx_sent_emails_candidate_id on public.sent_emails(candidate_id);

-- Create index for faster queries by startup
create index if not exists idx_sent_emails_startup_id on public.sent_emails(startup_id);

-- Create index for sorting by sent_at
create index if not exists idx_sent_emails_sent_at on public.sent_emails(sent_at desc);

-- Enable Row Level Security
alter table public.sent_emails enable row level security;

-- Policy: Users can only see their own sent emails
create policy "Users can view their own sent emails"
  on public.sent_emails
  for select
  using (
    exists (
      select 1
      from public.candidates
      where candidates.id = sent_emails.candidate_id
        and candidates.email = auth.jwt() ->> 'email'
    )
  );

-- Policy: Users can insert their own sent emails
create policy "Users can insert their own sent emails"
  on public.sent_emails
  for insert
  with check (
    exists (
      select 1
      from public.candidates
      where candidates.id = sent_emails.candidate_id
        and candidates.email = auth.jwt() ->> 'email'
    )
  );

