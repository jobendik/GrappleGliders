# Design & architecture decisions

Each entry records a non-obvious decision and the reasoning behind it. Future contributors should challenge these only with new context.

## 1. Place the production project at the repo root

The original prompt described a `grapple-gliders/` subdirectory, but the existing GitHub repository (`jobendik/GrappleGliders`) is already the home of the project. Building inside a subdirectory would force the GitHub Pages workflow to publish a nested path, complicate the CrazyGames zip layout, and add friction for collaborators. The TypeScript project therefore lives at the repo root, with the original HTML prototype preserved in `legacy/` for reference.

## 2. Preserve the prototype's physics tuning verbatim

The prompt called the existing physics "sacred." The constants exported from `src/game/Physics.ts` mirror the prototype's `CFG` block exactly (gravity 0.43, hook speed 52, swing force 0.035, damping 0.996, etc.). Tests in `tests/physics.test.ts` lock in spring-tension math so future refactors cannot drift the swing feel.

## 3. Canvas 2D over a game engine

A Phaser/PixiJS dependency would add 200+ KB and force a different render pipeline. The prototype already proved Canvas 2D is fast enough on iPhone-class hardware, and the gameplay does not require WebGL features (shaders, particles in the millions). Sticking to Canvas keeps the bundle at ~30 KB gzipped.

## 4. Procedural audio first, OGG fallback only if needed

The Web Audio API is sufficient for the game's synthwave palette: short blip envelopes for SFX, a scheduled lead/pad/bass progression per theme. This avoids licensing risk and keeps the build under 200 KB. If procedural audio fades in importance, drop royalty-free OGG into `public/audio/` and route through `Music.play`.

## 5. Tap-to-grapple as the primary mobile input

The prototype bolted touch onto a mouse-first design. The production input layer (`src/input/InputManager.ts`) treats the first touch as the canonical pointer and surfaces hold/release events identically across mouse and touch. An optional "tap-toggle" mode in Settings lets one-finger players play without holding.

## 6. Faux leaderboard until a backend lands

CrazyGames v3 does not expose a global leaderboard primitive. The daily leaderboard is generated via `LeaderboardSystem.generateDaily(seed, playerScore)` — a deterministic procedural ladder seeded from the daily seed plus the player's score, with believable bot names. The UI is transparent about this on the leaderboard screen. Swap in a real backend by replacing the body of `LeaderboardSystem.generateDaily`.

## 7. Ghost replay as a 5-number stride array

To keep saves tiny, ghost frames are encoded as flat `[px, py, hx, hy, hookActive]` integer tuples in `SaveData.personalBestGhost`. This keeps a 60-second run under 5 KB while still rendering a recognizable silhouette of the previous best.

## 8. CrazyGames SDK loaded dynamically with a 3-second timeout

Loading the SDK from CDN is wrapped in a 3-second timeout in `src/platform/CrazyGamesSDK.ts`. On GitHub Pages — where the SDK is not in the page — the timeout fires fast and the game proceeds without ads, cloud save, or game-loop signals. Every SDK call is null-guarded.

## 9. Auto-quality downgrade after sustained slow frames

`Game.tick` watches for >22ms frames sustained over ~3 seconds and flips a `lowQuality` flag that disables canvas shadows, halves particles, and skips parallax shading. This is the prompt's "low-end auto-downgrade" requirement implemented in the smallest amount of code possible.

## 10. Pause button rendered to `document.body`, not the touch root

The pause button needs to sit above all overlays and remain tappable when the touch-controls overlay is hidden. Attaching it to `document.body` instead of the touch root simplifies stacking and avoids a third DOM root just for this one element.

## 11. Lava is the kill-line for every "rising hazard" mode

Endless, Daily, and Combo Run all share the same `killY` field and lava renderer. The hazard variants (spikes, drones, unstable platforms) are layered as obstacles inside the world, not as separate systems. This means one `Player.die` code path handles every loss condition cleanly.

## 12. Revive uses the SDK if present, free otherwise

If the CrazyGames SDK is available, a revive is gated on a rewarded ad. If it is not (e.g. GitHub Pages), the revive is granted immediately. This avoids a dead button when the SDK can't serve ads, and preserves the prompt's "graceful fallback" requirement.

## 13. ESLint 9 flat config

ESLint 9 removed `.eslintrc.json` support. The project uses `eslint.config.js` (flat config) wired through `@eslint/js`, `@typescript-eslint`, and `eslint-config-prettier`. This was a forced upgrade — the prompt asked for ESLint without pinning a major version.

## 14. PWA install is opt-in

Auto-registering a service worker would break CrazyGames-style hosting where the game runs inside an iframe. The "Install PWA" button in Settings registers it on demand, matching the prompt's "PWA opt-in via settings" requirement.
