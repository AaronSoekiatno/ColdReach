-- Create waitlist table for collecting email addresses
create table if not exists public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.waitlist enable row level security;

-- Create policy to allow anyone to insert (for waitlist signups)
create policy "Allow public insert on waitlist"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);

-- Create policy to allow service role to read all (for admin access)
create policy "Allow service role to read waitlist"
  on public.waitlist
  for select
  to service_role
  using (true);

-- Create index on email for faster lookups
create index if not exists waitlist_email_idx on public.waitlist(email);

-- Create index on created_at for sorting
create index if not exists waitlist_created_at_idx on public.waitlist(created_at desc);

