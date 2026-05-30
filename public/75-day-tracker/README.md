# 75 Day Tracker

Self-contained local tracker for 75 Hard and 75 Soft attempts.

Open `index.html` directly in a browser. The app stores data in browser `localStorage`; exports are JSON files you can keep wherever you want.

## Challenge Templates

The tracker uses public rule summaries, not proprietary app copy or UI assets.

### 75 Hard

- Follow a chosen diet or nutrition plan.
- No alcohol and no cheat meals.
- Complete two 45-minute workouts; one should be outdoors.
- Drink one gallon of water.
- Read 10 pages of a nonfiction or self-improvement book.
- Take a progress photo.
- Missing any required task marks the attempt as failed/restart-required.

### 75 Soft

- Eat well; alcohol is limited to social occasions.
- Complete one 45-minute workout daily, with one active recovery day each week.
- Drink 3 liters of water.
- Read 10 pages.
- Misses are logged without forcing a restart.

## Public Sources Used

- Cleveland Clinic: 75 Soft and 75 Hard rule summaries.
- WebMD: 75 Soft and 75 Hard comparison and health context.
- Apple App Store listing for the official 75 Hard app: public feature list including checklist, reminders, photos, notes, attempts, and sharing.

## Scope

This is intentionally local-first:

- No account.
- No uploads.
- No push notifications.
- No proprietary screenshots, layout, branding, or assets.
- Photos are stored as local path/URL references only unless the browser later adds explicit file persistence.
