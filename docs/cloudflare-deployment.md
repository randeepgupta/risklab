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

## Workers AI

The Wrangler configuration declares an `AI` binding. Cloudflare deploys it with the Worker, so no Gemini API key or browser-side credential is required. RiskLab uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast` through `env.AI.run()`.

- What If submits the narrative and bounded portfolio context to the model in JSON-schema mode. All five factor shocks are checked and clamped before the deterministic risk engine calculates outcomes.
- The copilot receives bounded holdings and modeled risk metrics, then returns an explanation. It has no live price feed, news access, or trading tools.
- Each result identifies Cloudflare AI or a rule-based fallback. Inference errors, quota exhaustion, empty answers, and malformed scenario JSON use the labeled fallback. A failed browser/API request leaves the previous scenario unchanged.
- Requests are limited to 50 KB, prompt/question text to 2,000 characters, and inference output to 1,200 tokens for scenarios or 800 for explanations. The response timeout is 25 seconds; it does not guarantee cancellation of in-flight inference.
- The Free Workers plan includes a daily Workers AI allocation (currently 10,000 neurons across the account). On Free, exhausted quota makes AI requests fail; RiskLab uses its fallback. On a paid plan, usage over the included allocation can incur charges. This app does not implement an account-wide spend cap or persistent abuse-rate limiting.

Check `/api/health` after deployment: `aiConfigured: true` means the binding exists, not that an inference has succeeded. Submit a unique What If prompt and confirm the result says **Llama 3.3 · Cloudflare AI**, then ask a copilot question in **Advanced**. A **Rule-based fallback** result indicates an unconfigured or unavailable provider, not successful AI.

If Cloudflare asks you to enable Workers AI or accept model/service terms, complete that in your own account. No plan upgrade is required for this model's free allocation. Avoid enabling a paid plan unless desired.

Run `npm run test:ai` for mocked integration checks. Those tests do not prove live provider access or model quality. The Express local-development server retains its legacy Gemini/fallback implementation; use the Worker preview to test Cloudflare AI.

Sources: https://developers.cloudflare.com/workers-ai/configuration/bindings/, https://developers.cloudflare.com/workers-ai/features/json-mode/, https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/, and https://developers.cloudflare.com/workers-ai/platform/pricing/.

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
- Run a preset scenario and a natural-language scenario; confirm the AI source label.
- Open the copilot and verify an AI response, or a clearly labeled fallback if quota is exhausted.
- Refresh the page and check install/PWA assets.
- Request an unknown `/api/` path; expect JSON with HTTP 404.

## Files and behavior

`worker.ts` adapts the existing API to the Workers Fetch API. `wrangler.json` routes `/api/*` to the Worker and serves `dist/client` as static assets, with an HTML fallback for navigation. `npm run build:cloudflare` builds the browser app and bundles the Worker to `dist/server/index.js`.

The original `npm run dev`, `npm run build`, and `npm start` commands still use the Express server. Existing portfolio state remains local to the browser; this deployment does not migrate browser-local holdings between domains.

Sources: https://developers.cloudflare.com/workers/ci-cd/builds/ and https://developers.cloudflare.com/workers/static-assets/.
