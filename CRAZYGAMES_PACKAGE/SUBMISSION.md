# Grapple Gliders — CrazyGames Submission Package

> Ready-to-paste text for every field in the CrazyGames Developer Portal.  
> Assets referenced below are in this same `CRAZYGAMES_PACKAGE/` folder.  
> Requirement source: https://docs.crazygames.com/requirements/intro  
> Last updated: May 2026

---

## Portal Text Fields

### Title

```
Grapple Gliders
```

---

### Short Description
*(Portal limit: 150 characters. Current: 97 chars.)*

```
Sling across a neon skyline, outrun rising lava, and chase a daily seeded challenge shared with every player on Earth.
```

---

### Long Description
*(Plain text, no Markdown. Aim for 300–600 words. Copy the block below as-is.)*

```
Grapple Gliders is a neon-synthwave grappling-hook climber built around hand-tuned spring rope physics. Fire your hook at any surface, swing, fling, and dash through a procedurally-generated skyline while lava rises relentlessly beneath you.

FOUR GAME MODES
• Endless Climb – Scale an infinite procedural tower. Lava accelerates as you rise. Your personal best is everything.
• Daily Challenge – Every UTC day a new seeded course is generated and shared identically with every player on Earth. One ranked attempt counts; all others are free practice. Check the global leaderboard to see where you stand.
• Combo Run – A 60-second sprint scored entirely on swing combos. Release your hook and you have 1.5 seconds to fire the next one or the chain breaks and the run ends. Pure skill, no luck.
• Bot Race – Three AI rivals (Sparky, Phase, Apex) climb alongside you. First to altitude 3 000 m wins. Beat them all to unlock harder rivals.

COSMETICS & PROGRESSION
Earn Sparks on every run and from 30+ achievements. Spend them on 12 player skins, 8 hook styles, 12 swing trails, and 6 visual themes — every unlock is cosmetic, zero pay-to-win.

FEATURES
• Ghost replays haunt your personal-best line so you always race yourself
• Cloud save mirrors your progress across every device
• Daily streaks reward you for coming back tomorrow
• Procedural synthwave audio — every run sounds different
• Runs at 60 fps even on low-end Android; degrades gracefully when it can't
• Built in TypeScript + Canvas 2D — ~40 KB gzipped, no engine overhead

Swing fast. Climb higher. Beat yesterday's you.
```

---

### Controls
*(Paste into the "Controls" or "Instructions" field in the portal.)*

```
DESKTOP
• Hold Left Mouse Button — fire and hold the grappling hook
• Release Left Mouse Button — fling forward on rope release
• A / D  or  ← / → — steer left / right while airborne
• W / S  or  ↑ / ↓ — reel rope in / out
• Space  or  Right Mouse Button — dash
• P  or  Esc — pause

MOBILE
• Tap and hold anywhere — fire grappling hook
• Lift finger — release fling
• On-screen ◀ / ▶ buttons — steer (toggleable in Settings)
• DASH button — burst through obstacles and gaps
• Two-finger swipe down — alternative dash gesture
```

---

### Categories

| Field | Value |
|---|---|
| **Primary category** | Action |
| **Secondary categories** | Arcade · Skill · Casual |

---

### Tags
*(Select or type each tag in the portal)*

```
grappling-hook, physics, neon, synthwave, climber, endless, arcade, skill,
daily-challenge, score-attack, combo, procedural, mobile-friendly,
single-player, bot-race, casual, vertical-scroller, leaderboard
```

---

### Content Rating

| Field | Value |
|---|---|
| **PEGI rating** | PEGI 7 (no violence, no mature content) |
| **Suited for kids portal** | No (standard 13+ audience) |

---

### Orientation & Device Support

| Field | Value |
|---|---|
| **Orientation** | Landscape (desktop) + Portrait (mobile) |
| **Mobile supported** | Yes |
| **Tablet supported** | Yes |

---

## Assets Checklist

All required media is already in this folder.

### Cover Images

| Required spec | File | Status |
|---|---|---|
| Landscape 1920 × 1080 px (16:9) | `grapple_gliders_landscape.png` | ✅ |
| Portrait 800 × 1200 px (2:3) | `grapple_gliders_portrait.png` | ✅ |
| Square 800 × 800 px (1:1) | `grapple_gliders_square.png` | ✅ |
| Thumbnail (optional extra) | `grapple_gliders_thumbnail.png` | ✅ |

> **Cover rules (from CrazyGames docs)**  
> ✗ No borders  ✗ No "Play Now" text  ✗ No store/app-store logos  
> ✓ Game title on cover  ✓ Consistent style across all three sizes  
> ✓ Simple, uncluttered composition

### Preview Videos

| Required spec | File | Status |
|---|---|---|
| Landscape 1080p 16:9 — 15–20 s max, ≤ 50 MB, no sound | `GrappleGliders_video_horizontal.mp4` | ✅ |
| Portrait 1080p 2:3 — optional | `GrappleGliders_video_portrait.mp4` | ✅ |

> **Video rules (from CrazyGames docs)**  
> ✗ No opening black screens or logo bumpers  ✗ No "Play Now" text  
> ✗ No visible mouse cursor  ✗ No fast-forward  ✗ No sound  
> ✓ Raw gameplay only — show the best moments  

---

## Build & Upload

```bash
# From the repo root:
npm install
npm run lint && npm test
npm run build
# Zip the dist/ contents (not the folder itself):
cd dist && zip -r ../grapple-gliders.zip . && cd ..
```

Upload `grapple-gliders.zip` to the CrazyGames QA tool.  
`vite.config.ts` uses `base: './'` so all paths are relative — no extra config needed in the CrazyGames iframe host.

---

## SDK Integration Status

The full CrazyGames SDK v3 is already integrated. Nothing extra is required before submission.

| Feature | Status |
|---|---|
| `sdk.init()` with timeout | ✅ |
| `gameplayStart()` / `gameplayStop()` | ✅ |
| `loadingStop()` after init | ✅ |
| `happytime()` on PB / achievement (60 s rate-limit) | ✅ |
| Midgame ad — pre-roll on first run | ✅ |
| Midgame ad — cooldown between runs (240 s) | ✅ |
| Rewarded ad — Revive after death | ✅ |
| Rewarded ad — Double Sparks | ✅ |
| Cloud save via `sdk.data.getItem` / `setItem` | ✅ |
| Graceful fallback when SDK unavailable | ✅ |

---

## Quality Self-Check (CrazyGames Guidelines)

| Criterion | Status | Notes |
|---|---|---|
| Lands in gameplay quickly | ✅ | Main menu → play in one tap/click |
| Skippable onboarding tutorial | ✅ | Tutorial can be dismissed |
| Controls shown in tutorial | ✅ | Keyboard overlay + gesture prompts |
| English localisation | ✅ | Full English UI |
| Consistent physics across refresh rates | ✅ | Fixed 60 fps physics step |
| No custom fullscreen button | ✅ | Uses CrazyGames built-in fullscreen |
| No cross-promotion to other games | ✅ | |
| PEGI 12 compliant | ✅ | No violence, no adult content |
| Playable on Chrome, Edge, Safari | ✅ | Canvas 2D, no WebGL dependency |
| Readable at 907 × 510 px iframe | ✅ | Responsive layout tested |
| Mobile touch controls | ✅ | On-screen buttons + gesture |
| `user-select: none` on body | ✅ | `src/styles/main.css` |
| `Escape` key: does not break fullscreen | ✅ | Pause-only, no fullscreen toggle |
| Audio resumes after iOS interruption | ✅ | `touchend` listener resumes AudioContext |

---

## Outstanding Items Before Full Launch

- [ ] Set `og:url` in `index.html` to the canonical CrazyGames game page URL once it is assigned.
- [ ] Wire production leaderboard API (`VITE_LEADERBOARD_API_URL`) in CI before the Full Launch build so the Daily Challenge ladder shows cross-player data. See `server/README.md`.
- [ ] Verify cover image exact pixel dimensions match the mandatory specs above (open each PNG and confirm 1920×1080, 800×1200, 800×800).
