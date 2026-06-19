# 5MCU App Icon and Splash Screen Assets

Replace these placeholder references with real production assets before submitting to app stores.

## Required Files

| File | Dimensions | Format | Purpose |
|------|-----------|--------|---------|
| `icon.png` | 1024 x 1024 px | PNG, no alpha | iOS App Store icon, also used as the default app icon |
| `splash.png` | 1284 x 2778 px | PNG | Splash/launch screen (iPhone 14 Pro Max size, scales down) |
| `adaptive-icon.png` | 1024 x 1024 px | PNG with transparency | Android adaptive icon foreground layer |
| `notification-icon.png` | 96 x 96 px | PNG, white on transparent | Android notification tray icon |
| `favicon.png` | 48 x 48 px | PNG | Web favicon |

## Design Notes

- Brand colour: `#6366F1` (Indigo-500)
- App name: **5MCU** (Five Minute Catch Up)
- Icon should be simple, recognisable at small sizes
- Splash screen background colour is set to `#6366F1` in app.config.ts
- Android adaptive icon: only the foreground layer goes here; the background colour is set in config
- Notification icon must be single-colour (white) with transparent background per Android guidelines
