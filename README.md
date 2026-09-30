# Signal School

Practise writing clearer instructions and checking the answers. Six short exercises lead into three fictional cases about corrections, conflicting notes, and uncertainty. Feedback follows an authored teaching rubric; it is not a general skills assessment or an AI evaluator.

Built by Saran Vashisht. A clean source snapshot of newly developed modules; no private repository history is included.

## Run locally

Use Node.js 24.

```sh
npm ci
npx playwright install chromium
npm run dev
```

## Verify

```sh
npm run qa
```

This runs strict Astro/TypeScript checks, behavioral unit tests, a static production build, and desktop/mobile browser tests. Browser tests enforce the exact built content security policy. Host `dist` on a static host, applying `dist/_headers` on hosts that support it.

Read [the learning design and state boundaries](docs/ARCHITECTURE.md). XP rewards practice once; changing an answer clears its current feedback and does not turn the earlier award into a current pass.

## Privacy

Inputs and progress remain in browser memory and clear on refresh. No server, tracking, accounts, API keys or paid AI service. Clipboard access occurs only when a visitor chooses Copy. External links have their own privacy policies.

## Demo

[Open the working hosted course](https://saran.info/signal-school)

This repository contains the same interactive modules in a minimal standalone shell. The linked deployment provides the full visitor experience.
