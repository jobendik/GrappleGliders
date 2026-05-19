# Credits

## Game

- **Design & engineering** — Claude Code (Anthropic), acting on the autonomy mandate from the project owner.
- **Physics reference** — original `GrappleGliders.html` prototype preserved at `legacy/GrappleGliders.prototype.html`.

## Code & dependencies

- [Vite](https://vitejs.dev/) — MIT
- [TypeScript](https://www.typescriptlang.org/) — Apache 2.0
- [Vitest](https://vitest.dev/) — MIT
- [ESLint](https://eslint.org/) — MIT
- [Prettier](https://prettier.io/) — MIT
- [@typescript-eslint](https://typescript-eslint.io/) — MIT
- [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier) — MIT

## Audio

All sound effects and music are generated procedurally via the Web Audio API at runtime. No third-party samples or loops are bundled.

## Fonts

The game uses the system monospace font stack (`ui-monospace`, SF Mono, Menlo, Monaco, Consolas, etc.) — no web fonts are loaded, keeping the bundle small and the experience reliable offline.

## SDKs

- [CrazyGames SDK v3](https://docs.crazygames.com/sdk/) — loaded dynamically from the CrazyGames CDN. Optional; the game runs standalone without it.

## Inspiration

- The spring rope tuning was derived from the prototype build, which itself drew from classic grappling-hook arcade games. Specific gravity / damping numbers were preserved verbatim to honour the original feel.
