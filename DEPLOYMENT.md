# Deployment

The repository ships with a GitHub Actions workflow that lints, tests, builds, and publishes the game to GitHub Pages on every push to `main`.

## Live URL (once Pages is enabled)

`https://jobendik.github.io/GrappleGliders/`

## First-time setup (one-time, owner only)

Claude Code cannot enable Pages through the GitHub UI — only a repository admin can. Run this once:

1. Open the repository on GitHub: `https://github.com/jobendik/GrappleGliders`.
2. **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

That is the only manual step. After that, every push to `main` deploys automatically.

## Local deployment dry-run

```bash
npm install
npm run lint
npm run test
npm run build
npm run preview      # http://localhost:4173
```

The `preview` script serves the same artifact GitHub Pages will host, so use it to confirm a build before pushing.

## Manual workflow trigger

The deploy workflow also accepts `workflow_dispatch`, so you can re-run a deploy from the **Actions** tab without making a new commit.

## Custom domain

To attach a custom domain, add a `CNAME` file at the repo root containing the bare hostname (e.g. `play.grapplegliders.com`), then configure the DNS A/AAAA records per [GitHub's Pages docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site). The Vite `base: './'` setting keeps the build compatible with any host path.

## CrazyGames packaging

For a CrazyGames submission, run `npm run build`, then zip the contents of `dist/` (not the directory itself). Because `vite.config.ts` sets `base: './'`, the bundle works from any subdirectory the CrazyGames player serves it from. Promotional copy and store assets are bundled in [`STORE_LISTING.md`](./STORE_LISTING.md).

## Real leaderboard backend

To turn on real cross-player competition on the daily challenge, deploy the reference Cloudflare Worker in [`server/`](./server/README.md) (or wire your own service against the same contract) and set:

```env
VITE_LEADERBOARD_API_URL=https://your-worker.workers.dev
# Optional:
# VITE_LEADERBOARD_API_KEY=<bearer-token>
```

Copy `.env.example` to `.env.local` for local development, or set the variables in your CI deploy environment for the production build. Without these vars the game falls back to the offline local-only ladder.

## Troubleshooting

- **Workflow fails on `npm ci`** — make sure `package-lock.json` is committed.
- **Pages 404 after first deploy** — the first deployment can take 2–3 minutes to provision the environment. Re-check the Pages settings show the `github-pages` environment.
- **Assets 404 on a custom subpath** — confirm `vite.config.ts` still has `base: './'`. Absolute base paths break under subdirectory hosting.
