# 5MCU - Five Minute Catch Up
## Product Spec v1.0 — 18 Jun 2026

### One-liner
Schedule recurring 5-minute video catch-ups with the people you care about.

---

### Problem
People lose touch with friends because "let's catch up" never gets scheduled. Long calls feel like a commitment. Result: months pass without talking.

### Solution
Micro-scheduling: 5-minute slots, auto-recurring, one-tap video call launch.

---

## Core User Flows

### Flow 1: Set Availability
1. Open Schedule tab
2. See calendar for next 30 days
3. Tap time blocks to mark as available (each block = 5 min)
4. Bulk actions: "every weekday 8-9am", "weekends 10am-12pm"
5. Slots saved to DB, visible to invited friends

### Flow 2: Add Friends
1. Open Friends tab → "Add Friend"
2. Import from phone contacts (expo-contacts)
3. Select friend → set frequency: 1x/month, 2x/month, 4x/month (weekly)
4. Free tier: max 3 friends. Premium: unlimited.
5. Tap "Send Invite" → generates invite link (SMS/WhatsApp/email)

### Flow 3: Accept Invite (Friend's POV)
1. Friend receives link → opens in browser or app
2. If no account → onboarding (social login / email)
3. Sees: "{Name} wants to catch up {frequency}. Here are their available slots."
4. Friend books a slot → booking confirmed for both
5. Recurring: after each call, next slot auto-suggested based on frequency

### Flow 4: The Call
1. T-1 min: push notification "Video call with {Name} in 1 minute"
2. Tap notification → opens preferred video app:
   - FaceTime: `facetime://{phone}` (direct video call)
   - WhatsApp: `whatsapp://send?phone={phone}` (opens chat, tap video)
   - Jitsi Meet: auto-generated room URL (works everywhere, no account)
3. T+5 min: push notification:
   - If no next call: "5 min done! Keep chatting if you want"
   - If next call exists: "5 min done — you have a call with {NextPerson} soon"

### Flow 5: Recurring Booking
1. After a completed call, system checks frequency setting
2. Auto-suggests next available slot matching frequency
3. Friend gets notification: "Book your next catch-up with {Name}?"
4. One-tap booking confirmation

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Expo SDK 52+ / React Native | Cross-platform iOS+Android, single codebase |
| Routing | Expo Router (file-based) | Deep linking built-in, native navigation |
| Backend | Supabase | Auth, Postgres, Edge Functions, Realtime, Push |
| Auth | Supabase Auth | Google, Apple social login + email/password |
| Push | expo-notifications + Supabase Edge Functions | 1-min reminders, 5-min alerts |
| Contacts | expo-contacts | Import phone contacts for friend selection |
| IAP | RevenueCat (react-native-purchases) | Freemium subscriptions, App Store + Google Play |
| Video | Deep links (FaceTime/WhatsApp) + Jitsi fallback | Zero video infra cost |
| Build | EAS Build + EAS Submit | CI/CD for both stores |

---

## Database Schema (Supabase / Postgres)

### Tables
- **profiles** — user data, preferences, push tokens
- **availability_slots** — 5-min time blocks for next 30 days
- **friends** — user↔friend relationships with frequency
- **invites** — pending/accepted/declined invitations
- **bookings** — confirmed slot reservations
- **subscriptions** — freemium tier tracking

---

## Freemium Model

| Feature | Free | Premium ($2.99/mo) |
|---------|------|---------------------|
| Active friends | 3 | Unlimited |
| Availability slots | 20/month | Unlimited |
| Video app options | WhatsApp only | All (FaceTime, Jitsi, Zoom, custom) |
| Recurring auto-book | Manual | Auto-suggested |
| Call history | Last 7 days | Full history |

---

## Notification Schedule

| Event | Timing | Message |
|-------|--------|---------|
| Invite sent | Immediate | "{Name} wants to catch up!" |
| Booking confirmed | Immediate | "Call with {Name} booked for {date} {time}" |
| Call reminder | T-1 min | "Video call with {Name} in 1 minute" |
| Call end (no next) | T+5 min | "5 min done! Keep chatting" |
| Call end (next exists) | T+5 min | "5 min done — call with {Next} coming up" |
| Re-book nudge | After call | "Book next catch-up with {Name}?" |

---

## File Structure

```
5mcu-app/
├── app/                        # Expo Router
│   ├── (auth)/login.tsx
│   ├── (auth)/register.tsx
│   ├── (tabs)/_layout.tsx
│   ├── (tabs)/index.tsx        # Home: upcoming calls
│   ├── (tabs)/schedule.tsx     # Set availability
│   ├── (tabs)/friends.tsx      # Manage friends
│   ├── (tabs)/settings.tsx     # Preferences
│   ├── _layout.tsx
│   ├── onboarding.tsx
│   ├── invite/[id].tsx         # Accept invite
│   └── book/[friendId].tsx     # Book slot
├── components/
├── lib/
├── hooks/
├── types/
├── supabase/
│   ├── migrations/
│   └── functions/
├── app.json
├── package.json
└── eas.json
```

---

## Launch Checklist
- [ ] Domain: 5mcu.app (purchase via Namecheap/Google Domains)
- [ ] Apple Developer Account ($99/yr)
- [ ] Google Play Console (already have)
- [ ] Supabase project created
- [ ] RevenueCat account + products configured
- [ ] EAS Build configured
- [ ] App Store listing (screenshots, description)
- [ ] Google Play listing
- [ ] Privacy Policy + Terms of Service at 5mcu.app
