-- ============================================================================
-- 5MCU (Five Minute Catch Up) - Initial Schema Migration
-- ============================================================================
-- Description: Complete database schema for the 5MCU app, including tables,
--              RLS policies, triggers, functions, and indexes.
--              All objects use the fmcu_ prefix to coexist with other apps
--              in a shared Supabase project.
-- Created:     2026-06-18
-- ============================================================================

-- Enable required extensions
create extension if not exists "pgcrypto";


-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

create type public.fmcu_video_app as enum ('whatsapp', 'facetime', 'jitsi', 'zoom');
create type public.fmcu_friend_status as enum ('pending', 'active', 'paused');
create type public.fmcu_invite_status as enum ('pending', 'accepted', 'declined', 'expired');
create type public.fmcu_booking_status as enum ('confirmed', 'completed', 'cancelled', 'no_show');
create type public.fmcu_sub_tier as enum ('free', 'premium');
create type public.fmcu_sub_provider as enum ('apple', 'google', 'stripe');


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Generate a short random invite code (8 alphanumeric characters)
create or replace function public.fmcu_generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no I/1/O/0 to avoid confusion
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- Auto-update the updated_at column
create or replace function public.fmcu_handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auto-create a profile row when a new auth user is inserted
create or replace function public.fmcu_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.fmcu_profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone, '')
  );
  return new;
end;
$$;


-- ============================================================================
-- TABLE: fmcu_profiles
-- Extends auth.users with app-specific fields.
-- ============================================================================

create table public.fmcu_profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null default '',
  phone          text,
  avatar_url     text,
  preferred_video_app public.fmcu_video_app not null default 'whatsapp',
  push_token     text,
  timezone       text not null default 'UTC',
  is_premium     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.fmcu_profiles is 'User profiles extending auth.users with 5MCU-specific fields.';

-- Trigger: auto-update updated_at
create trigger fmcu_profiles_updated_at
  before update on public.fmcu_profiles
  for each row execute function public.fmcu_handle_updated_at();

-- Trigger: auto-create profile on signup
create trigger fmcu_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fmcu_handle_new_user();


-- ============================================================================
-- TABLE: fmcu_availability_slots
-- 5-minute windows a user marks as available for calls.
-- ============================================================================

create table public.fmcu_availability_slots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.fmcu_profiles (id) on delete cascade,
  start_time  timestamptz not null,
  end_time    timestamptz not null generated always as (start_time + interval '5 minutes') stored,
  is_booked   boolean not null default false,
  booked_by   uuid references public.fmcu_profiles (id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint fmcu_availability_slots_user_start_unique unique (user_id, start_time),
  constraint fmcu_availability_slots_start_before_end check (start_time < start_time + interval '5 minutes')
);

comment on table public.fmcu_availability_slots is 'Five-minute availability windows users publish for friends to book.';


-- ============================================================================
-- TABLE: fmcu_friends
-- Each row represents a friendship from the perspective of user_id.
-- friend_user_id is null until the friend joins the app.
-- ============================================================================

create table public.fmcu_friends (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.fmcu_profiles (id) on delete cascade,
  friend_user_id   uuid references public.fmcu_profiles (id) on delete set null,
  friend_name      text not null,
  friend_phone     text,
  friend_email     text,
  frequency_per_month int not null default 1
    check (frequency_per_month in (1, 2, 4)),
  status           public.fmcu_friend_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint fmcu_friends_user_phone_unique unique (user_id, friend_phone)
);

comment on table public.fmcu_friends is 'User''s friend list. friend_user_id is null until the friend accepts and joins.';

-- Trigger: auto-update updated_at
create trigger fmcu_friends_updated_at
  before update on public.fmcu_friends
  for each row execute function public.fmcu_handle_updated_at();


-- ============================================================================
-- TABLE: fmcu_invites
-- Invitation links sent from one user to a friend entry.
-- ============================================================================

create table public.fmcu_invites (
  id                  uuid primary key default gen_random_uuid(),
  from_user_id        uuid not null references public.fmcu_profiles (id) on delete cascade,
  to_friend_id        uuid not null references public.fmcu_friends (id) on delete cascade,
  invite_code         text not null unique default public.fmcu_generate_invite_code(),
  status              public.fmcu_invite_status not null default 'pending',
  frequency_per_month int not null default 1
    check (frequency_per_month in (1, 2, 4)),
  expires_at          timestamptz not null default (now() + interval '30 days'),
  created_at          timestamptz not null default now()
);

comment on table public.fmcu_invites is 'Shareable invite links with short codes, valid for 30 days.';


-- ============================================================================
-- TABLE: fmcu_bookings
-- A confirmed 5-minute call between host (slot owner) and guest (friend).
-- ============================================================================

create table public.fmcu_bookings (
  id              uuid primary key default gen_random_uuid(),
  slot_id         uuid not null references public.fmcu_availability_slots (id) on delete cascade,
  host_id         uuid not null references public.fmcu_profiles (id) on delete cascade,
  guest_id        uuid not null references public.fmcu_profiles (id) on delete cascade,
  friend_link_id  uuid not null references public.fmcu_friends (id) on delete cascade,
  status          public.fmcu_booking_status not null default 'confirmed',
  video_app       public.fmcu_video_app,
  video_url       text,
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz not null default now()
);

comment on table public.fmcu_bookings is 'Booked 5-minute calls between a host and guest.';


-- ============================================================================
-- TABLE: fmcu_subscriptions
-- Tracks premium subscription state per user.
-- ============================================================================

create table public.fmcu_subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.fmcu_profiles (id) on delete cascade,
  tier                     public.fmcu_sub_tier not null default 'free',
  provider                 public.fmcu_sub_provider,
  provider_subscription_id text,
  expires_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint fmcu_subscriptions_user_unique unique (user_id)
);

comment on table public.fmcu_subscriptions is 'One subscription record per user tracking tier and provider details.';

-- Trigger: auto-update updated_at
create trigger fmcu_subscriptions_updated_at
  before update on public.fmcu_subscriptions
  for each row execute function public.fmcu_handle_updated_at();


-- ============================================================================
-- INDEXES
-- ============================================================================

-- fmcu_availability_slots: look up available slots by user and time range
create index idx_fmcu_availability_slots_user_id on public.fmcu_availability_slots (user_id);
create index idx_fmcu_availability_slots_start_time on public.fmcu_availability_slots (start_time);
create index idx_fmcu_availability_slots_unbooked on public.fmcu_availability_slots (user_id, start_time)
  where is_booked = false;

-- fmcu_friends: look up by user, by linked user, and by status
create index idx_fmcu_friends_user_id on public.fmcu_friends (user_id);
create index idx_fmcu_friends_friend_user_id on public.fmcu_friends (friend_user_id)
  where friend_user_id is not null;
create index idx_fmcu_friends_status on public.fmcu_friends (status);

-- fmcu_invites: look up by code (already unique), by sender, by status
create index idx_fmcu_invites_from_user_id on public.fmcu_invites (from_user_id);
create index idx_fmcu_invites_status on public.fmcu_invites (status);

-- fmcu_bookings: look up by host, guest, slot, and status
create index idx_fmcu_bookings_host_id on public.fmcu_bookings (host_id);
create index idx_fmcu_bookings_guest_id on public.fmcu_bookings (guest_id);
create index idx_fmcu_bookings_slot_id on public.fmcu_bookings (slot_id);
create index idx_fmcu_bookings_status on public.fmcu_bookings (status);

-- fmcu_subscriptions: user_id already has a unique index via the constraint


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.fmcu_profiles enable row level security;
alter table public.fmcu_availability_slots enable row level security;
alter table public.fmcu_friends enable row level security;
alter table public.fmcu_invites enable row level security;
alter table public.fmcu_bookings enable row level security;
alter table public.fmcu_subscriptions enable row level security;


-- --------------------------------------------------------------------------
-- FMCU_PROFILES RLS
-- --------------------------------------------------------------------------

-- Users can read their own profile
create policy "fmcu_profiles_select_own"
  on public.fmcu_profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "fmcu_profiles_update_own"
  on public.fmcu_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Friends can read profiles of users who added them (for displaying host info)
create policy "fmcu_profiles_select_as_friend"
  on public.fmcu_profiles for select
  using (
    exists (
      select 1 from public.fmcu_friends f
      where f.user_id = fmcu_profiles.id
        and f.friend_user_id = auth.uid()
        and f.status = 'active'
    )
  );


-- --------------------------------------------------------------------------
-- FMCU_AVAILABILITY_SLOTS RLS
-- --------------------------------------------------------------------------

-- Users can read their own slots
create policy "fmcu_slots_select_own"
  on public.fmcu_availability_slots for select
  using (auth.uid() = user_id);

-- Users can insert their own slots
create policy "fmcu_slots_insert_own"
  on public.fmcu_availability_slots for insert
  with check (auth.uid() = user_id);

-- Users can update their own slots
create policy "fmcu_slots_update_own"
  on public.fmcu_availability_slots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own unbooked slots
create policy "fmcu_slots_delete_own_unbooked"
  on public.fmcu_availability_slots for delete
  using (auth.uid() = user_id and is_booked = false);

-- Friends can read unbooked slots of users who added them (to see available times)
create policy "fmcu_slots_select_as_friend"
  on public.fmcu_availability_slots for select
  using (
    exists (
      select 1 from public.fmcu_friends f
      where f.user_id = fmcu_availability_slots.user_id
        and f.friend_user_id = auth.uid()
        and f.status = 'active'
    )
  );


-- --------------------------------------------------------------------------
-- FMCU_FRIENDS RLS
-- --------------------------------------------------------------------------

-- Users can read friends they added
create policy "fmcu_friends_select_own"
  on public.fmcu_friends for select
  using (auth.uid() = user_id);

-- Users can also see friend entries where they are the friend
create policy "fmcu_friends_select_as_friend"
  on public.fmcu_friends for select
  using (auth.uid() = friend_user_id);

-- Users can insert friends they own
create policy "fmcu_friends_insert_own"
  on public.fmcu_friends for insert
  with check (auth.uid() = user_id);

-- Users can update friends they own
create policy "fmcu_friends_update_own"
  on public.fmcu_friends for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete friends they own
create policy "fmcu_friends_delete_own"
  on public.fmcu_friends for delete
  using (auth.uid() = user_id);


-- --------------------------------------------------------------------------
-- FMCU_INVITES RLS
-- --------------------------------------------------------------------------

-- Users can read invites they sent
create policy "fmcu_invites_select_own"
  on public.fmcu_invites for select
  using (auth.uid() = from_user_id);

-- Users can insert invites they send
create policy "fmcu_invites_insert_own"
  on public.fmcu_invites for insert
  with check (auth.uid() = from_user_id);

-- Users can update invites they sent (e.g. cancel)
create policy "fmcu_invites_update_own"
  on public.fmcu_invites for update
  using (auth.uid() = from_user_id)
  with check (auth.uid() = from_user_id);

-- Anyone authenticated can read an invite by code (for accepting invites)
-- This is intentionally broad so invite recipients can look up the invite
create policy "fmcu_invites_select_by_code"
  on public.fmcu_invites for select
  using (auth.uid() is not null);


-- --------------------------------------------------------------------------
-- FMCU_BOOKINGS RLS
-- --------------------------------------------------------------------------

-- Host can read their bookings
create policy "fmcu_bookings_select_host"
  on public.fmcu_bookings for select
  using (auth.uid() = host_id);

-- Guest can read their bookings
create policy "fmcu_bookings_select_guest"
  on public.fmcu_bookings for select
  using (auth.uid() = guest_id);

-- Guest can insert a booking (they are the one booking the slot)
create policy "fmcu_bookings_insert_guest"
  on public.fmcu_bookings for insert
  with check (auth.uid() = guest_id);

-- Host can update booking status (e.g. mark completed, no_show)
create policy "fmcu_bookings_update_host"
  on public.fmcu_bookings for update
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

-- Guest can update booking status (e.g. cancel)
create policy "fmcu_bookings_update_guest"
  on public.fmcu_bookings for update
  using (auth.uid() = guest_id)
  with check (auth.uid() = guest_id);


-- --------------------------------------------------------------------------
-- FMCU_SUBSCRIPTIONS RLS
-- --------------------------------------------------------------------------

-- Users can read their own subscription
create policy "fmcu_subscriptions_select_own"
  on public.fmcu_subscriptions for select
  using (auth.uid() = user_id);

-- Users can insert their own subscription (initial creation)
create policy "fmcu_subscriptions_insert_own"
  on public.fmcu_subscriptions for insert
  with check (auth.uid() = user_id);

-- Users can update their own subscription
create policy "fmcu_subscriptions_update_own"
  on public.fmcu_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============================================================================
-- GRANT USAGE
-- ============================================================================

-- Allow the authenticated and anon roles to use the public schema
grant usage on schema public to anon, authenticated;

-- Grant table access to authenticated users (RLS handles row filtering)
grant select, insert, update, delete on public.fmcu_profiles to authenticated;
grant select, insert, update, delete on public.fmcu_availability_slots to authenticated;
grant select, insert, update, delete on public.fmcu_friends to authenticated;
grant select, insert, update    on public.fmcu_invites to authenticated;
grant select, insert, update    on public.fmcu_bookings to authenticated;
grant select, insert, update    on public.fmcu_subscriptions to authenticated;

-- Allow anon to read invites (for invite-code lookup before signup)
grant select on public.fmcu_invites to anon;

-- Grant function execution
grant execute on function public.fmcu_generate_invite_code() to authenticated;
grant execute on function public.fmcu_handle_updated_at() to authenticated;
