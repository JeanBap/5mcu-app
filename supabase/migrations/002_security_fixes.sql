-- ============================================================================
-- 5MCU - Security Fixes Migration
-- ============================================================================
-- Fixes:
--   S1: Revoke direct UPDATE on fmcu_subscriptions from authenticated role.
--       Only service_role (edge functions / webhooks) should modify tier.
--   S2: Document push_token exposure via friend-select RLS (accepted risk).
--   S6: Add UNIQUE constraint on fmcu_bookings.slot_id to prevent double-booking.
-- Created: 2026-06-19
-- ============================================================================


-- --------------------------------------------------------------------------
-- S1: Prevent client-side subscription self-upgrade
-- --------------------------------------------------------------------------
-- The original fmcu_subscriptions_update_own policy allowed any authenticated
-- user to UPDATE their own subscription row, including changing tier to
-- 'premium' without payment. Fix: revoke UPDATE entirely from the
-- authenticated role. Only service_role (used by edge functions like
-- webhook-revenuecat) can modify subscription records.

-- Drop the permissive update policy
DROP POLICY IF EXISTS "fmcu_subscriptions_update_own" ON public.fmcu_subscriptions;

-- Revoke the UPDATE grant from authenticated users
REVOKE UPDATE ON public.fmcu_subscriptions FROM authenticated;

-- NOTE: service_role bypasses RLS and retains full UPDATE access, so the
-- webhook-revenuecat edge function continues to work without changes.


-- --------------------------------------------------------------------------
-- S2: push_token exposure via friend-select RLS (accepted risk)
-- --------------------------------------------------------------------------
-- The fmcu_profiles_select_as_friend policy lets active friends SELECT all
-- columns from fmcu_profiles, including push_token. Postgres RLS cannot
-- filter individual columns -- it is row-level, not column-level.
--
-- Risk assessment: Expo push tokens (e.g. ExponentPushToken[...]) are NOT
-- authentication credentials. They can only be used to send push
-- notifications via Expo's push service, and Expo rate-limits senders.
-- Leaking a push token does not grant account access, data access, or
-- any privileged action. The worst case is unsolicited push notifications,
-- which the OS lets the user disable per-app.
--
-- Accepted: The exposure is low-risk. The real mitigation is to ensure
-- the app code only queries the columns it needs (full_name, avatar_url,
-- preferred_video_app) when displaying friend profiles, so push_token is
-- never fetched client-side in practice.
--
-- If a stronger guarantee is needed in the future, create a Postgres VIEW
-- that excludes push_token and grant friends SELECT on the view instead.
-- No schema change applied for S2.


-- --------------------------------------------------------------------------
-- S6: Prevent double-booking the same availability slot
-- --------------------------------------------------------------------------
-- Without a UNIQUE constraint on fmcu_bookings.slot_id, two concurrent
-- booking requests could both INSERT for the same slot, creating a
-- double-booking. The partial index on fmcu_availability_slots.is_booked
-- helps at read time, but does not prevent the race at INSERT time on the
-- bookings table.

ALTER TABLE public.fmcu_bookings
  ADD CONSTRAINT fmcu_bookings_slot_id_unique UNIQUE (slot_id);
