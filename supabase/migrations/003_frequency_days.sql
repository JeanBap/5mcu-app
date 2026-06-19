-- Migration: Add frequency_days column to fmcu_friends and fmcu_invites
-- Replaces the limited frequency_per_month (1,2,4) with flexible day intervals
-- Supports: weekly(7), biweekly(14), 3-weekly(21), monthly(30), bimonthly(60),
--           quarterly(90), semi-annual(180), annual(365)

-- fmcu_friends: add frequency_days, backfill from frequency_per_month
ALTER TABLE fmcu_friends
  ADD COLUMN IF NOT EXISTS frequency_days int NOT NULL DEFAULT 30;

-- Backfill existing rows: convert per-month to days
UPDATE fmcu_friends SET frequency_days = CASE
  WHEN frequency_per_month = 4 THEN 7    -- weekly
  WHEN frequency_per_month = 2 THEN 14   -- biweekly
  WHEN frequency_per_month = 1 THEN 30   -- monthly
  ELSE 30
END;

-- fmcu_invites: add frequency_days, backfill
ALTER TABLE fmcu_invites
  ADD COLUMN IF NOT EXISTS frequency_days int NOT NULL DEFAULT 30;

UPDATE fmcu_invites SET frequency_days = CASE
  WHEN frequency_per_month = 4 THEN 7
  WHEN frequency_per_month = 2 THEN 14
  WHEN frequency_per_month = 1 THEN 30
  ELSE 30
END;

-- Add CHECK constraint for valid values
ALTER TABLE fmcu_friends
  ADD CONSTRAINT fmcu_friends_frequency_days_check
  CHECK (frequency_days IN (7, 14, 21, 30, 60, 90, 180, 365));

ALTER TABLE fmcu_invites
  ADD CONSTRAINT fmcu_invites_frequency_days_check
  CHECK (frequency_days IN (7, 14, 21, 30, 60, 90, 180, 365));
