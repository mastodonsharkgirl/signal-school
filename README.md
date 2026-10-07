# Signal School

Signal School starts in a Workroom for checking an AI-assisted draft against its source notes before sharing it. It includes three fictional workplace practice cases: a supplier decision, release readiness, and an incident update. The six short foundation exercises remain under Learn, and the original source-aware cases remain in the separate Final challenge workspace. Feedback follows authored teaching references; it is not a general skills assessment or an AI evaluator.

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

Inputs and progress remain in browser memory and clear on refresh. A claim check stays out of a handoff until it is saved; the download dialog makes that choice explicit. Replacing meaningful Workroom material or resetting the course also asks before it clears anything. No server, tracking, accounts, API keys or paid AI service. Clipboard access occurs only when a visitor chooses Copy. External links have their own privacy policies.

## Local preview

[Open the existing hosted course](https://saran.info/signal-school)

The expanded Workroom is verified in this standalone checkout. The linked portfolio page has its own release and verification state; it is not evidence that this local Workroom source is deployed there.
