# CrazyGames Ready Audit — Grapple Gliders

> Audited against the current `main` branch.  
> Last updated: all bugs and gaps from the original audit have been resolved.  
> Sections: ✅ Pass · ❌ Bug (blocks deploy) · ⚠️ Gap (quality / polish) · ℹ️ Notes

---

## 1. CrazyGames SDK Integration

| Check | Status | Evidence |
|---|---|---|
| SDK v3 script tag in `index.html` | ✅ | `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>` |
| `sdk.init()` called with timeout | ✅ | `CrazyGamesPlatform.ts` – races `sdk.init()` against a 2 500 ms timeout so boot is never blocked |
| Disabled-environment probe (`sdk.game`, `sdk.data`) | ✅ | Safe getter probe disables the adapter cleanly on non-CG domains |
| `loadingStop()` called after init | ✅ | `this.safeCall(() => sdk.game.loadingStop?.())` at end of `init()` |
| `gameplayStart()` at run start | ✅ | `Game.ts:1266` — called inside `startMode()` |
| `gameplayStop()` at run end | ✅ | `Game.ts:1533` — first thing in `endRun()` |
| `happytime()` on PB and achievement unlock | ✅ | Called in `notifyUnlock`, on score/altitude PB, and on gold Time Attack medal |
| `happytime()` rate-limited (≥60 s) | ✅ | `HAPPYTIME_COOLDOWN_MS = 60_000` enforced in `CrazyGamesPlatform` |

---

## 2. Advertisements

| Check | Status | Evidence |
|---|---|---|
| Midgame ad — preroll on first run | ✅ | `startMode()` checks `!this.prerollShown` and calls `requestAd('midgame', 240)` |
| Midgame ad — cooldown between runs | ✅ | `maybeShowAd()` called in `endRun()` with 240 s cooldown |
| Rewarded ad — Revive | ✅ | `requestRevive()` requests `rewarded`; free revive granted when SDK unavailable |
| Rewarded ad — Double Sparks | ✅ | `watchDoubleAd()` requests `rewarded`; adds `lastRunSparks` on success. Dead `bonus * 0` variable removed. |
| `adStarted` / `adFinished` / `adError` callbacks implemented | ✅ | All three present in `CrazyGamesPlatform.requestAd()` |
| `crazy.available` gates all ad buttons | ✅ | `adsAvailable: this.crazy.available` passed to `GameOverContext` |

---

## 3. Cloud Save

| Check | Status | Evidence |
|---|---|---|
| `sdk.data.getItem` / `setItem` used | ✅ | `cloudAdapter()` wraps both with error-to-disable handling |
| Cloud sync on boot | ✅ | `bootPlatform()` attaches cloud adapter and triggers `syncFromCloud()` |
| Naive merge preserves highest scores | ✅ | `SaveSystem.syncFromCloud()` takes `Math.max` for all numeric bests |
| Unlock union — no data loss | ✅ | Skins/hooks/trails/themes merged as a `Set` union |
| Leaderboard submissions merged | ✅ | Deduplicated by `date|name|score|timestamp`, capped at 200 |
| Local `localStorage` fallback | ✅ | `flush()` writes to `localStorage` regardless of cloud availability |
| Save flushed at run end | ✅ | `save.flush()` called explicitly in `endRun()` |

---

## 4. HTML / Metadata

| Check | Status | Evidence |
|---|---|---|
| `viewport` — `user-scalable=no`, `viewport-fit=cover` | ✅ | `index.html` line 8 |
| `og:title` and `og:description` | ✅ | Present in `<head>` |
| `og:type` | ✅ | `"website"` |
| `description` meta | ✅ | Full game description present |
| `theme-color` | ✅ | `#03040a` |
| Apple mobile web-app meta | ✅ | `apple-mobile-web-app-capable`, status bar style |
| `<noscript>` fallback | ✅ | Friendly message shown when JS is disabled |
| **`og:image`** | ✅ | `./public/promo/og-banner.svg` referenced with width/height/alt meta tags. |
| **`og:url`** | ⚠️ **Missing** | CrazyGames recommends this; set it to the canonical CG game page URL once known. |
| Web App Manifest (`link rel="manifest"`) | ⚠️ Missing | Not required by CrazyGames but recommended. Only `favicon.svg` is present in `public/icons/`. |

---

## 5. Build & Packaging

| Check | Status | Evidence |
|---|---|---|
| `base: './'` in `vite.config.ts` | ✅ | Ensures all asset paths are relative — required for CrazyGames subdirectory hosting |
| Hashed output filenames | ✅ | `[name]-[hash].js` / `[name]-[hash][extname]` |
| `target: 'es2022'` | ✅ | Modern baseline; CrazyGames browsers all support it |
| `cssCodeSplit: false` | ✅ | Single CSS bundle, simpler to zip |
| `package-lock.json` committed | ✅ | Required for `npm ci` in CI |
| CrazyGames packaging: zip `dist/` contents | ✅ | Documented in `DEPLOYMENT.md` |
| `robots.txt` present | ✅ | `public/robots.txt` |

---

## 6. Mobile / Input

| Check | Status | Evidence |
|---|---|---|
| Touch controls rendered | ✅ | `ensureTouchControls()` in `startMode()` / revive |
| Soft steering buttons | ✅ | `setSoftSteer()` + `mobileSteering` setting |
| Two-finger swipe-down for dash | ✅ | `twoFingerSwipeDown` in `InputManager` |
| Tap-toggle mode | ✅ | `tapToggle` setting; double-tap releases hook |
| `passive: false` on `touchstart` / `touchmove` | ✅ | Required to call `preventDefault()` |
| Auto-pause on tab hide / window blur | ✅ | `visibilitychange` + `blur` listeners in `Game` constructor |
| Touch controls removed on game over | ✅ | `removeTouchControls()` in `endRun()` |

---

## 7. Gameplay Systems

| Check | Status | Evidence |
|---|---|---|
| All 5 game modes start / end correctly | ✅ | Endless, Daily, Time Attack, Bot Race, Combo Run |
| Lava accelerates over time | ✅ | `lavaSpeed += lavaAcceleration * dt` after frame 600 |
| Slow-lava pickup slows lava to 25% | ✅ | `lavaSpeed * 0.25 * dt` when `slowLavaFrames > 0` |
| Revive — once per run | ✅ | `hasUsedRevive` flag |
| Ghost recording / playback | ✅ | Encoded as flat number array; loaded on PB run |
| Streak tracking | ✅ | `tickLoginStreak()` on every `SaveSystem` construction |
| Daily challenge deduplication (one ranked attempt) | ✅ | `dailyRankedThisAttempt` flag; `hasSubmittedToday()` check |
| Auto-quality downgrade on sustained 60+ fps misses | ✅ | `slowFrameCount` → `particles.setLimit(100)` |

---

## 8. Achievements

| Check | Status | Evidence |
|---|---|---|
| Altitude milestones (100–10 000 m) | ✅ | `setProgress('climb-*', ...)` every frame |
| Combo milestones, perfect anchors, near-misses | ✅ | All wired in `updatePlay()` |
| Dash count, Iron Lungs, streak, level | ✅ | All tracked and unlocked correctly |
| Bot Race wins | ✅ | Checked per-bot at `endRun` |
| Time Attack medals | ✅ | `ta-bronze/silver/gold` unlocked in `completeTimeAttack()` |
| Daily attempt, top-50, top-10 | ✅ (with caveat) | **See Gap 3 below.** |
| **`shield-saved` achievement** | ✅ | `onShieldAbsorb` event added to `PlayerEvents`; fired at both shield-absorb sites; wired in `Game.ts` to unlock `shield-saved`. |

---

## 9. Pickup Feedback (UX)

| Check | Status | Evidence |
|---|---|---|
| Spark pickup — floating text + particle burst | ✅ | `+1` text, yellow burst |
| Shield pickup — toast + floating text + sound | ✅ | `"Shield ready — blocks the next hit."` |
| Magnet pickup — floating text + sound | ✅ | Screen text `MAGNET`, SFX |
| **Magnet pickup — toast** | ✅ | `"Magnet active — pulls in nearby sparks for 6 seconds."` |
| Slow pickup — floating text + sound | ✅ | Screen text `SLOW LAVA`, SFX |
| **Slow pickup — toast** | ✅ | `"Slow lava active — rising hazard at quarter speed."` |

---

## Bugs (resolved)

### Bug 1 — `watchDoubleAd()`: dead `bonus` variable from literal `* 0` ✅ Fixed

**File:** `src/game/Game.ts`

The `bonus` variable was always `0` due to `* 0`. Removed `bonus` entirely; `this.save.data.sparks += lastRunSparks` now stands alone.

---

### Bug 2 — `shield-saved` achievement: permanently unreachable ✅ Fixed

**Files:** `src/game/Player.ts` + `src/game/Game.ts`

Added `onShieldAbsorb: () => void` to `PlayerEvents` and `DEFAULT_EVENTS`. The event is now fired at both shield-consume sites (lava kill-line and spike collision). Wired in `Game.ts` `setEvents` block to call `this.achievements.unlock('shield-saved', this.notifyUnlock)`.

---

## Gaps (resolved)

### Gap 1 — Missing `og:image` ✅ Fixed

`index.html` now includes `<meta property="og:image" content="./public/promo/og-banner.svg">` with width/height/alt meta tags and matching Twitter card tags.

### Gap 2 — Missing toasts for `magnet-pickup` and `slow-pickup` ✅ Fixed

Both pickups now call `this.toast.show(...)` with descriptive messages.

### Gap 3 — `daily-top50` / `daily-top10` percentile diluted by bot entries ✅ Fixed

**File:** `src/game/Game.ts`

```ts
// Before (broken — divided by total entries including bots):
const pct = (myEntry.rank - 1) / Math.max(1, snapshot.entries.length);

// After (correct — divides by real player count only):
const pct = (myEntry.rank - 1) / Math.max(1, snapshot.realPlayerCount);
```

### Gap 4 — Missing `og:url` ⚠️ Pending

Set to the canonical CrazyGames game page URL once known.

---

## Summary

| Category | Result |
|---|---|
| CrazyGames SDK (init, lifecycle, ads) | ✅ Ready |
| Cloud save | ✅ Ready |
| Mobile controls | ✅ Ready |
| Build packaging (`base: './'`, hashed assets) | ✅ Ready |
| Game modes | ✅ Ready |
| `shield-saved` achievement | ✅ Fixed |
| `watchDoubleAd` dead `bonus * 0` | ✅ Fixed |
| `og:image` | ✅ Fixed |
| `magnet`/`slow-lava` pickup toasts | ✅ Fixed |
| `daily-top50/top10` percentile includes bots | ✅ Fixed |
| `og:url` canonical URL | ⚠️ Set once CG page URL is known |

**Overall verdict: Nearly there.** Fix Bug 1 (one-line delete) and Bug 2 (add `onShieldAbsorb` event) before submitting to CrazyGames. The platform-facing integration (SDK, ads, cloud save, mobile controls, build config) is solid.
