create extension if not exists "pgcrypto";

create type public.member_role as enum ('owner', 'admin', 'member');
create type public.email_provider as enum ('gmail', 'outlook');
create type public.thread_status as enum ('draft', 'sent', 'replied', 'bounced', 'needs_follow_up');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.states (
  id text primary key,
  name text not null,
  abbreviation text not null unique,
  fips text not null unique
);

create table public.counties (
  id text primary key,
  state_id text not null references public.states(id) on delete cascade,
  name text not null,
  fips text not null,
  unique (state_id, fips)
);

create table public.municipalities (
  id text primary key,
  county_id text not null references public.counties(id) on delete cascade,
  state_id text not null references public.states(id) on delete cascade,
  name text not null,
  kind text not null,
  place_fips text not null,
  unique (county_id, place_fips)
);

create table public.departments (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text not null default ''
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  municipality_id text not null references public.municipalities(id) on delete cascade,
  department_id text not null references public.departments(id) on delete cascade,
  name text not null,
  title text not null,
  email text not null,
  phone text,
  source_url text not null,
  confidence integer not null check (confidence between 0 and 100),
  verified boolean not null default false,
  last_checked date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_verification_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  status text not null,
  note text,
  source_url text,
  created_at timestamptz not null default now()
);

create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider public.email_provider not null,
  email text not null,
  encrypted_refresh_token text not null,
  provider_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, email)
);

create table public.outreach_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  municipality_id text not null references public.municipalities(id) on delete restrict,
  department_id text not null references public.departments(id) on delete restrict,
  email_account_id uuid not null references public.email_accounts(id) on delete restrict,
  provider public.email_provider not null,
  subject text not null,
  status public.thread_status not null default 'draft',
  provider_thread_id text,
  created_by uuid not null references auth.users(id) on delete restrict,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  outreach_thread_id uuid not null references public.outreach_threads(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  provider_message_id text,
  from_email text not null,
  to_email text not null,
  subject text not null,
  body text not null,
  sent_or_received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.reply_events (
  id uuid primary key default gen_random_uuid(),
  outreach_thread_id uuid not null references public.outreach_threads(id) on delete cascade,
  provider_message_id text not null,
  received_at timestamptz not null,
  snippet text,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.email_accounts enable row level security;
alter table public.outreach_threads enable row level security;
alter table public.messages enable row level security;
alter table public.reply_events enable row level security;
alter table public.states enable row level security;
alter table public.counties enable row level security;
alter table public.municipalities enable row level security;
alter table public.departments enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_verification_logs enable row level security;

create or replace function public.user_in_org(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
  );
$$;

create policy "members can read own organizations"
on public.organizations for select
using (public.user_in_org(id));

create policy "users can read own profile"
on public.profiles for select
using (id = auth.uid());

create policy "members can read org members"
on public.organization_members for select
using (public.user_in_org(organization_id));

create policy "verified geography is public to authenticated users"
on public.states for select
to authenticated
using (true);

create policy "counties are public to authenticated users"
on public.counties for select
to authenticated
using (true);

create policy "municipalities are public to authenticated users"
on public.municipalities for select
to authenticated
using (true);

create policy "departments are public to authenticated users"
on public.departments for select
to authenticated
using (true);

create policy "verified contacts are public to authenticated users"
on public.contacts for select
to authenticated
using (verified = true);

create policy "members can manage email accounts"
on public.email_accounts for all
using (public.user_in_org(organization_id))
with check (public.user_in_org(organization_id));

create policy "members can manage outreach threads"
on public.outreach_threads for all
using (public.user_in_org(organization_id))
with check (public.user_in_org(organization_id));

create policy "members can read messages through thread org"
on public.messages for select
using (
  exists (
    select 1 from public.outreach_threads t
    where t.id = outreach_thread_id
      and public.user_in_org(t.organization_id)
  )
);

create policy "members can create messages through thread org"
on public.messages for insert
with check (
  exists (
    select 1 from public.outreach_threads t
    where t.id = outreach_thread_id
      and public.user_in_org(t.organization_id)
  )
);

create policy "members can read reply events through thread org"
on public.reply_events for select
using (
  exists (
    select 1 from public.outreach_threads t
    where t.id = outreach_thread_id
      and public.user_in_org(t.organization_id)
  )
);

create policy "members can create reply events through thread org"
on public.reply_events for insert
with check (
  exists (
    select 1 from public.outreach_threads t
    where t.id = outreach_thread_id
      and public.user_in_org(t.organization_id)
  )
);
