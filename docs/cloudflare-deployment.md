# Cloudflare deployment

## GitHub auto-deploy

Commit `worker.ts`, `wrangler.json`, the updated `package.json`, `.gitignore`, README, and this guide to `randeepgupta/risklab`.

In Cloudflare, open **Workers & Pages → Create application → Import a repository** and select `randeepgupta/risklab`.

| Setting | Value |
| --- | --- |
| Worker name | `risklab` |
| Production branch | Your repository default branch |
| Root directory | Repository root |
| Build command | `npm run build:cloudflare` |
| Deploy command | `npx wrangler deploy` |
| Node version | 22 (if a version selector is shown) |

The Worker name must match `name` in `wrangler.json`. Select Deploy. Cloudflare provides a `workers.dev` address once deployment succeeds, and future commits to the connected branch trigger deployment.

No database or API key is needed for the current app. Without `GEMINI_API_KEY`, scenario parsing and the copilot use the existing deterministic fallback. This migration preserves the existing Gemini integration and model selection; a live Gemini model and key must be verified separately before enabling paid AI calls. It does not add Workers AI or live market data.

If you enable Gemini later, add `GEMINI_API_KEY` as a **runtime secret** in the Worker settings. Never put it in GitHub, a `VITE_` variable, or a frontend build variable.

## Deploy from a computer

```sh
npm ci
npm run build:cloudflare
npx wrangler login
npx wrangler deploy
```

For local Worker preview after building:

```sh
npx wrangler dev
```

## Verify deployment

- Open `/api/health`; expect JSON with `status: "ok"`.
- Build or load a sample portfolio and inspect risk metrics.
- Run a preset scenario and a natural-language scenario without an API key.
- Open the copilot and verify a fallback response.
- Refresh the page and check install/PWA assets.
- Request an unknown `/api/` path; expect JSON with HTTP 404.

## Files and behavior

`worker.ts` adapts the existing API to the Workers Fetch API. `wrangler.json` routes `/api/*` to the Worker and serves `dist/client` as static assets, with an HTML fallback for navigation. `npm run build:cloudflare` builds the browser app and bundles the Worker to `dist/server/index.js`.

The original `npm run dev`, `npm run build`, and `npm start` commands still use the Express server. Existing portfolio state remains local to the browser; this deployment does not migrate browser-local holdings between domains.

Sources: https://developers.cloudflare.com/workers/ci-cd/builds/ and https://developers.cloudflare.com/workers/static-assets/.
