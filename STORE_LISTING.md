# CrazyGames Store Listing

Drop-in copy + asset map for the CrazyGames developer portal submission.

## Title

**Grapple Gliders**

## Short description (≤ 150 chars)

> Sling across a neon skyline. Outrun rising lava. Chase a daily seed shared with every player on Earth.

## Long description

> Grapple Gliders is a neon-synthwave climber built around a hand-tuned spring grappling hook. Fire, swing, fling, and dash through a procedural skyline while the lava chases you up the tower. Five modes give the swing physics room to breathe — go forever in **Endless Climb**, chase gold on four hand-crafted courses in **Time Attack** (Rookie, The Spire, Pendulum, Inferno), beat three rivals in **Bot Race**, sprint a combo-only minute in **Combo Run**, or settle the day on a seeded **Daily Challenge** that's identical for every player on Earth.
>
> Earn Sparks from runs and achievements, then spend them on 12 skins, 8 hooks, 12 trails, and 6 themes — all cosmetic, no pay-to-win. Cloud save mirrors progress across devices. Ghost replays haunt your personal best line. Daily streaks reward you for coming back tomorrow.
>
> Built from scratch in TypeScript + Canvas 2D for a ~40 KB gzipped bundle that runs at 60 fps on low-end Android — and gracefully degrades when it can't.

## Categories

Primary: **Action**
Secondary: **Arcade**, **Skill**, **Casual**

## Tags

`grappling-hook`, `synthwave`, `neon`, `climber`, `physics`, `daily-challenge`, `arcade`, `endless`, `combo`, `score-attack`, `mobile-friendly`, `single-player`, `bot-race`, `casual`, `vertical`, `procedural`

## Controls

**Desktop**
- **Hold left mouse** — fire and hold the grapple
- **Release** — fling forward
- **A / D or ←/→** — steer mid-air
- **W / S or ↑/↓** — reel rope in/out
- **Space or right-click** — dash
- **P or Esc** — pause

**Mobile**
- **Tap & hold anywhere** — fire grapple
- **Lift finger** — release fling
- **On-screen ◀/▶** — steer (toggleable in Settings)
- **DASH button** — burst through gaps
- **Two-finger swipe down** — alternative dash gesture

## Required assets

| Asset                  | Source in repo                                 | Export size |
| ---------------------- | ---------------------------------------------- | ----------- |
| Cover image            | `public/promo/cover.svg`                       | 800×600 PNG  |
| Social preview         | `public/promo/og-banner.svg`                   | 1200×630 PNG |
| Screenshot — Gameplay  | `public/promo/screenshot-01-swing.svg`         | 1280×720 PNG |
| Screenshot — Daily     | `public/promo/screenshot-02-daily.svg`         | 1280×720 PNG |
| Screenshot — Bot Race  | `public/promo/screenshot-03-podium.svg`        | 1280×720 PNG |

See `public/promo/README.md` for the export commands.

## Submission build

```bash
npm install
npm run lint && npm test
npm run build
cd dist && zip -r ../grapple-gliders.zip . && cd ..
```

Upload `grapple-gliders.zip` to the CrazyGames portal. The `vite.config.ts` `base: './'` setting ensures all paths are relative, so the zip works from the CrazyGames iframe host without further config.

## Optional but recommended before submitting

- Wire a real leaderboard backend (see `server/README.md`) and set `VITE_LEADERBOARD_API_URL` in CI before the production build. With this, the daily challenge ladder shows real cross-player competition.
- Convert the SVGs in `public/promo/` to PNG (see `public/promo/README.md`).
