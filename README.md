# Grapple Gliders

A neon synthwave grappling-hook climber. Swing, dash, and outrun the rising lava.

> **Play now:** [jobendik.github.io/GrappleGliders](https://jobendik.github.io/GrappleGliders/)

Built as a single-page TypeScript + Vite + Canvas 2D experience. No frameworks, no engines — direct DOM and a hand-tuned spring rope. Five game modes, twelve skins, eight hooks, twelve trails, six themes, thirty-plus achievements, daily challenges with deterministic seeding, ghost replays, bot races, time attack, and a 60-second combo sprint.

## Quick controls

| Action | Desktop | Mobile |
| ------ | ------- | ------ |
| Fire & hold grapple | Hold left mouse | Tap and hold |
| Release fling | Release left mouse | Lift finger |
| Steer in air | `A` / `D` or arrows | Tilt with extra finger taps |
| Reel rope in / out | `W` / `S` | Hold finger longer to reel in |
| Dash | `Space` or right-click | On-screen DASH button or two-finger swipe down |
| Pause | `P` or `Esc` | Top-right pause icon |

## Tech stack

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-2-6e9f18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![ESLint](https://img.shields.io/badge/ESLint-9-4b32c3?logo=eslint&logoColor=white)](https://eslint.org/)

## Develop

```bash
npm install
npm run dev          # Vite dev server with HMR
npm run test         # Vitest unit tests
npm run lint         # ESLint
npm run build        # Type-check, then production bundle into dist/
npm run preview      # Serve the production build locally
```

The dev server runs on `http://localhost:5173`. Hot module replacement is wired through Vite — edits to `src/**` reload instantly.

## Architecture

```
                ┌──────────────────────┐
                │       main.ts        │ bootstraps Game with DOM roots
                └──────────┬───────────┘
                           ▼
                ┌──────────────────────┐
                │       Game.ts        │ state machine, ticks at 60fps
                └──────┬───────┬───────┘
                       │       │
   ┌───────────────────┘       └────────────────────────────┐
   ▼                                                        ▼
┌──────────┐  ┌──────────┐  ┌──────────┐    ┌───────────┐ ┌─────────────┐
│ Player + │  │ World    │  │ Camera   │    │ Renderer  │ │ UI screens  │
│ Bot AI   │  │ obstacles│  │ shake/   │    │ + parallax│ │ HUD, menus, │
│ + Hook   │  │ + lava   │  │ slowmo   │    │ + particles│ │ unlock shop │
└────┬─────┘  └──────────┘  └──────────┘    └───────────┘ └─────────────┘
     │
┌────▼───────────────────────────────────────────────────────────────────┐
│ Systems: Scoring · Combo · Progression · Save · Achievements · Daily   │
│ Unlocks · Leaderboard · Haptics · Audio (procedural SFX + music)       │
└─────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ Platform: CrazyGames SDK (ads, cloud save) · PWA    │
└─────────────────────────────────────────────────────┘
```

## Game modes

- **Endless Climb** — Procedural infinite tower, lava accelerates, personal best is everything.
- **Daily Challenge** — Seeded course shared across all players each UTC day. One ranked attempt; the rest are practice.
- **Time Attack** — Curated layout, race to altitude 5000m for Bronze / Silver / Gold medals.
- **Combo Run** — 60-second sprint. Chain grapples within 1.5s of the previous release. Drop the chain and the run ends.
- **Bot Race** — Three rivals named Sparky, Phase, and Apex. Beat them to altitude 3000m.

## Save data

All progression is persisted to `localStorage` under `grapple-gliders.v1.save`, debounced to 500ms. When running inside CrazyGames, the same payload is mirrored to cloud save with a last-write-wins merge that protects against accidental progress loss. Use **Settings → Export Save** to download a JSON backup.

## Deployment

The GitHub Actions workflow at `.github/workflows/deploy.yml` runs lint, tests, and a production build on every push to `main`, then publishes `dist/` to GitHub Pages. See `DEPLOYMENT.md` for first-time setup notes.

## License

MIT — see `LICENSE`.

## Credits

- Hand-coded by Claude Code with full creative latitude.
- Spring rope physics tuned from the original `GrappleGliders.html` prototype, preserved in `legacy/` for reference.
- Procedural synthwave audio courtesy of the Web Audio API — no third-party samples.
- See `CREDITS.md` for a complete list.
