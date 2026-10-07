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

`src/lib/transfer-challenge.ts` owns the original authored challenge cases and evaluator. `src/lib/experience.ts` owns the six foundation lessons and progress helpers. `src/lib/workroom.ts` owns the versioned JSON handoff schema, content fingerprints, quote-offset validation, revision snapshots, strict JSON restore, and the three fictional workplace cases with their authored references. `src/components/Workroom.tsx` presents the staged request and sources → build prompt → check draft → download handoff workflow. `src/components/SignalSchool.tsx` owns the shared workspace rail and explicit full reset. `src/styles/signal-school.css` preserves the course's cyan/amber visual system.

The interface groups the work into three named workspaces: **Learn** for the six authored exercises, **Workroom** for an evidence-bound review of a person’s own draft, and **Final challenge** for the original source-aware cases. Workroom is the default entry and remains mounted while a learner changes workspace, so ordinary navigation cannot lose a handoff; the explicit course reset clears it. Nothing persists after refresh.

The Workroom never rates an arbitrary draft. It records only claims the person selected, then binds each decision to exact draft/source quotes and stable source IDs. Its deterministic comparison is available only for an unchanged fictional case; a changed case or any own-work pack remains manual. A reference match means the saved verdict and exact selected draft/source excerpts cover the authored reference. It does not judge a person's reasoning, prose, or the rest of a draft. Reference eligibility compares the exact canonical revision content; the shorter fingerprint is display metadata only. A content edit archives the complete previous review snapshot, clears current decisions, and makes the current revision evidence-incomplete until it is reviewed again.

The in-progress claim-check form is deliberately separate from the saved review state. It is marked unfinished until the person saves it, and a handoff download must offer a return, save, discard, or explicit without-it decision. Case changes, starting own work, clear, valid JSON restore, and the global reset use the native confirmation dialog whenever the current Workroom is meaningful; it restores focus on cancellation and offers a handoff route before replacement. Parsed JSON is still validated before this choice, so an invalid file leaves the current Workroom untouched.

Markdown handoffs fence authored values as literal data, using a delimiter longer than any backtick run in that value. The same boundary covers current content, complete archived snapshots, unresolved messages and the portable prompt. Formatting in source material cannot supply application-authored headings or approval labels. The reference evaluator examines all saved decisions for each exact draft span: incompatible verdicts are conflicting, and a positive result requires every decision to cover the fixed reference evidence.

## Selective host integration

When the Workroom is brought into the portfolio host, copy `workroom.ts`, `Workroom.tsx`, and the related scoped CSS alongside a narrow `SignalSchool` integration. Do not replace the host’s `experience.ts` wholesale: it also exports unrelated portfolio material. Preserve the host’s existing CSP and browser checks, then run its separate QA suite.

The standalone shell is deliberately small. The existing portfolio page at [Saran's portfolio](https://saran.info/signal-school/) contains the older course experience; this rebuilt Workroom is verified only in this local standalone checkout until the selective host integration above is completed. The surrounding portfolio, scene and arcade are maintained separately.

## Verification boundary

Run `npm run qa` for this standalone checkout. Case evaluator and progress tests are executable source evidence, rather than claims about workplace competence. The portfolio host has its own browser, CSP, responsive and offline checks; its passing checks do not automatically validate this shell.
