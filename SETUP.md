# 5MCU Setup Guide

## Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Supabase account
- RevenueCat account
- Apple Developer account ($99/yr) -- NEEDED
- Google Play Console -- HAVE

## 1. Clone and Install
```bash
cd 5mcu-app
npm install
```

## 2. Supabase Setup
1. Create new Supabase project
2. Run migration: copy `supabase/migrations/001_initial_schema.sql` into SQL editor
3. Enable Google + Apple auth providers in Authentication > Providers
4. Deploy edge functions:
```bash
supabase functions deploy send-invite
supabase functions deploy process-booking
supabase functions deploy call-reminder
supabase functions deploy call-end-alert
supabase functions deploy auto-suggest-rebooking
supabase functions deploy webhook-revenuecat
```
5. Set up pg_cron for call-reminder (every minute) and call-end-alert (every minute)
6. Set up pg_cron for auto-suggest-rebooking (daily at 9am UTC)

## 3. Environment Variables
```bash
cp .env.example .env
# Fill in:
# EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
# EXPO_PUBLIC_REVENUECAT_APPLE_KEY=xxx
# EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=xxx
# EXPO_PUBLIC_APP_URL=https://5mcu.app
```

## 4. RevenueCat Setup
1. Create RevenueCat project
2. Add Apple App Store + Google Play Store apps
3. Create "premium" entitlement
4. Create product: $2.99/month subscription
5. Add API keys to .env
6. Set webhook URL: `{SUPABASE_URL}/functions/v1/webhook-revenuecat`

## 5. Development Build
```bash
npx expo start --dev-client
# Or create a dev build:
eas build --profile development --platform all
```

## 6. Production Build
```bash
eas build --profile production --platform all
eas submit --platform all
```

## 7. Domain Setup (5mcu.app)
1. Purchase domain
2. Deploy landing page with:
   - App Store / Play Store links
   - Privacy Policy
   - Terms of Service
3. Set up universal links / app links for deep linking

## Cron Jobs (Supabase pg_cron)
```sql
-- Call reminders: every minute
SELECT cron.schedule('call-reminder', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/call-reminder',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )
$$);

-- Call end alerts: every minute
SELECT cron.schedule('call-end-alert', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/call-end-alert',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )
$$);

-- Auto-suggest rebooking: daily at 9am UTC
SELECT cron.schedule('auto-suggest', '0 9 * * *', $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/auto-suggest-rebooking',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )
$$);
```
