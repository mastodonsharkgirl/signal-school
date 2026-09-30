# Reviewable learning, without a model call

Signal School uses short authored cases to practise separating what a note says from what a draft claims. It does not score a person's general ability, certify skills, or evaluate arbitrary AI answers.

## Boundaries in the design

- A case has a request, source cards, claims, and handoff options. Stable IDs identify them; visible wording is not used as a database key.
- The reference rubric accepts explicit alternative evidence sets. For example, either of two matching venue notes can establish the same venue; an unresolved time conflict needs both conflicting notes.
- An explicit correction resolves the original note only when it says it replaces that fact. The tool does not teach that later text is always more trustworthy.
- A copied instruction is source material, not permission to ignore the actual request. The course performs no sending or publishing action.
- The evaluator returns missing, needs-review, or matched feedback for each item. It does not infer correctness from prose length or keyword matches.
- A changed answer or new case clears the current result. Earned XP remains a separate one-time practice reward until reset; it is not evidence that the currently displayed answer passes.
- All interaction state lives in browser memory. Clipboard/download actions are explicit; no notes or answers are submitted to a server.

## Implementation map

`src/lib/transfer-challenge.ts` owns the authored cases and evaluator. `src/lib/experience.ts` owns the original six lessons, prompt assembly and progress helpers. `src/components/SignalSchool.tsx` presents the workflow. `src/styles/signal-school.css` preserves the course's cyan/amber visual system.

The standalone shell is deliberately small. The same reviewed interactive source is deployed within [Saran's portfolio](https://saran.info/signal-school/); the surrounding portfolio, scene and arcade are maintained separately.

## Verification boundary

Run `npm run qa` for this standalone checkout. Case evaluator and progress tests are executable source evidence, rather than claims about workplace competence. The portfolio host has its own browser, CSP, responsive and offline checks; its passing checks do not automatically validate this shell.
