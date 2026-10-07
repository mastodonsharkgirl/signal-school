import { describe, expect, it } from 'vitest';

import {
  WORKROOM_LIMITS,
  advancedCases,
  applyContentChange,
  blankWorkroom,
  captureExactQuote,
  createReviewPack,
  createWorkroomFromCase,
  evaluateAuthoredCase,
  getReviewSummary,
  hasMeaningfulWorkroom,
  nextCitationId,
  parseReviewPack,
  replaceWorkroom,
  resetWorkroom,
  restoreImportedState,
  serializeReviewPack,
  validateReview,
  type ReviewEntry,
  type WorkroomState,
} from './workroom';

function reviewedState(): WorkroomState {
  const state = blankWorkroom();
  state.brief = {
    task: 'Prepare a factual release update.',
    audience: 'Support lead',
    output: 'A short decision note',
    boundary: 'Use only the source cards.',
    unknowns: 'No additional unknowns are recorded yet.',
  };
  state.criteria = [{ id: 'CR-1', text: 'Name the open risk.', review: 'met' }];
  state.sources = [
    { id: 'SRC-1', title: 'Status note', text: 'Android testing remains open.' },
    { id: 'SRC-2', title: 'Policy', text: 'The release manager records go or no-go.' },
  ];
  state.draft = 'Android testing remains open. The release manager will decide.';
  state.reviewerNote = 'A teammate should inspect the decision before it is shared.';
  state.reviews = [
    {
      id: 'CL-1',
      claim: 'Android testing is open.',
      draftQuote: 'Android testing remains open.',
      draftOffset: 0,
      citations: [
        {
          id: 'CIT-1',
          sourceId: 'SRC-1',
          quote: 'Android testing remains open.',
          offset: 0,
        },
      ],
      verdict: 'supported',
      reason: 'The draft repeats the status note exactly.',
    },
  ];
  return state;
}

describe('workroom review boundaries', () => {
  it('archives one complete immutable reviewed revision before a content edit and clears current decisions', () => {
    const state = reviewedState();
    const before = getReviewSummary(state);
    expect(before.status).toBe('ready-for-human-review');

    const changed = applyContentChange(
      state,
      { draft: 'Android testing remains open. A decision is still needed.' },
      '2026-10-07T10:00:00.000Z',
    );

    expect(changed.reviews).toEqual([]);
    expect(changed.criteria[0]?.review).toBe('not-reviewed');
    expect(changed.reviewerNote).toBe('');
    expect(getReviewSummary(changed).status).toBe('evidence-incomplete');
    expect(changed.priorSnapshots).toHaveLength(1);
    expect(changed.priorSnapshots[0]).toMatchObject({
      archivedAt: '2026-10-07T10:00:00.000Z',
      reason: 'content-changed',
      fingerprint: before.fingerprint,
      status: 'ready-for-human-review',
      content: {
        draft: 'Android testing remains open. The release manager will decide.',
        reviewerNote: 'A teammate should inspect the decision before it is shared.',
      },
    });
    expect(changed.priorSnapshots[0]?.content.reviews).toHaveLength(1);
    expect(changed.priorSnapshots[0]?.content.criteria[0]?.review).toBe('met');

    const changedAgain = applyContentChange(changed, { brief: { ...changed.brief, task: 'Revise the release update.' } });
    expect(changedAgain.priorSnapshots).toHaveLength(1);
  });

  it('binds a selected repeated quotation to its captured offset through export and restore', () => {
    const state = reviewedState();
    const repeated = 'The release is ready.';
    state.draft = `${repeated} But the note needs context. ${repeated}`;
    state.sources = [{ id: 'SRC-1', title: 'Release note', text: `${repeated} ${repeated}` }];
    const draftOffset = state.draft.lastIndexOf(repeated);
    const sourceOffset = state.sources[0]!.text.lastIndexOf(repeated);
    const quote = captureExactQuote(state.draft, draftOffset, draftOffset + repeated.length);
    const sourceQuote = captureExactQuote(state.sources[0]!.text, sourceOffset, sourceOffset + repeated.length);
    expect(quote).toEqual({ quote: repeated, offset: draftOffset });
    expect(sourceQuote).toEqual({ quote: repeated, offset: sourceOffset });
    state.reviews = [{
      id: 'CL-1',
      claim: 'The draft says the release is ready.',
      draftQuote: quote.quote,
      draftOffset: quote.offset,
      citations: [{ id: 'CIT-1', sourceId: 'SRC-1', quote: sourceQuote.quote, offset: sourceQuote.offset }],
      verdict: 'supported',
      reason: 'This exact occurrence was selected in both text areas.',
    }];

    expect(validateReview(state.reviews[0]!, state.sources, state.draft)).toBe('');
    const restored = parseReviewPack(JSON.stringify(createReviewPack(state)));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.error);
    expect(restored.state.reviews[0]?.draftOffset).toBe(draftOffset);
    expect(restored.state.reviews[0]?.citations[0]?.offset).toBe(sourceOffset);
  });

  it('serializes a complete reviewed history into a JSON pack the parser can reconstruct without loss', () => {
    const state = reviewedState();
    const edited = applyContentChange(
      state,
      { draft: 'Android testing remains open. The release manager will decide after the final check.' },
      '2026-10-07T12:00:00.000Z',
    );

    const serialized = serializeReviewPack(edited);
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) throw new Error(serialized.error);
    expect(serialized.byteLength).toBeLessThanOrEqual(WORKROOM_LIMITS.maxPackBytes);

    const restored = parseReviewPack(serialized.text);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.error);
    expect(restored.state.priorSnapshots[0]?.content.draft).toBe(state.draft);
    expect(restored.state.draft).toBe(edited.draft);

    const tooLargeForSchema = reviewedState();
    tooLargeForSchema.draft = 'x'.repeat(WORKROOM_LIMITS.maxDraftLength + 1);
    expect(serializeReviewPack(tooLargeForSchema)).toMatchObject({ ok: false });
  });

  it('generates citation IDs across the whole pack so multiple reviewed claims can round-trip', () => {
    const state = reviewedState();
    const citationId = nextCitationId({ citations: [] }, state.reviews.flatMap((review) => review.citations));
    expect(citationId).toBe('CIT-2');
    state.reviews.push({
      ...state.reviews[0]!,
      id: 'CL-2',
      claim: 'The release manager decides.',
      draftQuote: 'The release manager will decide.',
      draftOffset: state.draft.indexOf('The release manager will decide.'),
      citations: [{ ...state.reviews[0]!.citations[0]!, id: citationId }],
    });

    const serialized = serializeReviewPack(state);
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) throw new Error(serialized.error);
    const restored = parseReviewPack(serialized.text);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.error);
    expect(restored.state.reviews.map((review) => review.citations[0]?.id)).toEqual(['CIT-1', 'CIT-2']);
  });

  it('keeps multi-citation source disagreement distinct and unresolved', () => {
    const state = reviewedState();
    state.draft = 'The rollout will happen on Thursday.';
    state.sources = [
      { id: 'SRC-1', title: 'Operations note', text: 'The rollout is planned for Thursday.' },
      { id: 'SRC-2', title: 'Release note', text: 'The rollout is planned for Friday.' },
    ];
    const review: ReviewEntry = {
      id: 'CL-1',
      claim: 'Rollout date',
      draftQuote: 'The rollout will happen on Thursday.',
      draftOffset: 0,
      citations: [
        { id: 'CIT-1', sourceId: 'SRC-1', quote: 'The rollout is planned for Thursday.', offset: 0 },
        { id: 'CIT-2', sourceId: 'SRC-2', quote: 'The rollout is planned for Friday.', offset: 0 },
      ],
      verdict: 'sources-disagree',
      reason: 'The two dated notes conflict, so the date needs an owner decision.',
    };
    state.reviews = [review];

    expect(validateReview(review, state.sources, state.draft)).toBe('');
    expect(getReviewSummary(state).unresolvedItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'claim', id: 'CL-1' })]),
    );
  });

  it('keeps a contradicted selected claim in the unresolved handoff list', () => {
    const state = reviewedState();
    state.reviews[0] = { ...state.reviews[0]!, verdict: 'contradicted' };

    expect(getReviewSummary(state).unresolvedItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'claim', id: 'CL-1' })]),
    );
  });

  it('keeps citations stable through source reordering and flags a deleted source instead of retargeting it', () => {
    const state = reviewedState();
    const review = state.reviews[0]!;
    state.sources = [...state.sources].reverse();
    expect(validateReview(review, state.sources, state.draft)).toBe('');

    state.sources = state.sources.filter((source) => source.id !== 'SRC-1');
    expect(validateReview(review, state.sources, state.draft)).toMatch(/no longer exists/i);
    expect(getReviewSummary(state).status).toBe('evidence-incomplete');
  });

  it('rejects malformed, oversized, wrong-version and unknown-key packs without changing current work', () => {
    const state = reviewedState();
    const before = JSON.stringify(state);
    const pack = createReviewPack(state);
    const wrongVersion = parseReviewPack(JSON.stringify({ ...pack, version: 999 }));
    const unknownKey = parseReviewPack(JSON.stringify({ ...pack, untrusted: { nested: true } }));
    const malformed = parseReviewPack('{not json');
    const oversized = parseReviewPack('x'.repeat(WORKROOM_LIMITS.maxPackBytes + 1));

    expect(wrongVersion.ok).toBe(false);
    expect(unknownKey.ok).toBe(false);
    expect(malformed.ok).toBe(false);
    expect(oversized.ok).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('constructs an allowlisted restored state and recomputes review metadata', () => {
    const state = reviewedState();
    const pack = createReviewPack(state);
    const tampered = {
      ...pack,
      review: { ...pack.review, fingerprint: 'forged', status: 'ready-for-human-review' },
    };
    const result = parseReviewPack(JSON.stringify(tampered));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.summary.fingerprint).not.toBe('forged');
    expect(result.summary.fingerprint).toBe(getReviewSummary(result.state).fingerprint);
    expect(result.state).not.toHaveProperty('review');
  });

  it('records the actual outgoing revision before a valid restore and clears fully on reset', () => {
    const current = reviewedState();
    const incoming = blankWorkroom();
    incoming.brief.task = 'Imported task';
    incoming.brief.audience = 'Imported audience';
    incoming.brief.output = 'Imported output';
    incoming.brief.boundary = 'Imported boundary';
    incoming.brief.unknowns = 'Imported unknowns';
    const restored = restoreImportedState(current, incoming, '2026-10-07T11:00:00.000Z');

    expect(restored.brief.task).toBe('Imported task');
    expect(restored.priorSnapshots).toHaveLength(1);
    expect(restored.priorSnapshots[0]?.reason).toBe('before-restore');
    expect(restored.priorSnapshots[0]?.content.draft).toBe(current.draft);
    expect(resetWorkroom()).toEqual(blankWorkroom());
  });

  it('archives meaningful own work before replacement but does not archive an untouched practice case', () => {
    const pristine = createWorkroomFromCase('supplier');
    const replacement = createWorkroomFromCase('release');
    const ownWork = blankWorkroom();
    ownWork.brief = {
      task: 'Write the customer update.',
      audience: 'Affected customers',
      output: 'A concise email',
      boundary: 'Use the incident notes only.',
      unknowns: 'The root cause is still open.',
    };
    ownWork.sources = [{ id: 'SRC-1', title: 'Incident note', text: 'Some export requests failed.' }];
    ownWork.draft = 'We are checking the export issue.';

    expect(hasMeaningfulWorkroom(pristine)).toBe(false);
    expect(hasMeaningfulWorkroom(ownWork)).toBe(true);
    expect(replaceWorkroom(pristine, replacement, '2026-10-07T11:30:00.000Z').priorSnapshots).toHaveLength(0);

    const replaced = replaceWorkroom(ownWork, replacement, '2026-10-07T11:30:00.000Z');
    expect(replaced.priorSnapshots).toHaveLength(1);
    expect(replaced.priorSnapshots[0]).toMatchObject({
      reason: 'before-replacement',
      content: { draft: 'We are checking the export issue.' },
    });
    expect(parseReviewPack(JSON.stringify(createReviewPack(replaced)))).toMatchObject({ ok: true });
  });

  it('does not call an unrelated excerpt from the right source card a practice-reference match', () => {
    const state = createWorkroomFromCase('supplier');
    const reference = advancedCases.find((item) => item.id === 'supplier')!.reference.judgments[0]!;
    const source = state.sources.find((item) => item.id === 'SUP-02')!;
    const unrelatedQuote = 'The delivery date is a supplier commitment in the quote; dispatch has not happened.';
    const selected: ReviewEntry = {
      id: 'CL-1',
      claim: reference.claim,
      draftQuote: reference.draftQuote,
      draftOffset: reference.draftOffset,
      citations: [{
        id: 'CIT-1',
        sourceId: source.id,
        quote: unrelatedQuote,
        offset: source.text.indexOf(unrelatedQuote),
      }],
      verdict: reference.verdict,
      reason: 'This exact excerpt is real but does not cover the fixed reference evidence.',
    };
    state.reviews = [selected];

    expect(validateReview(selected, state.sources, state.draft)).toBe('');
    expect(evaluateAuthoredCase(state)).toMatchObject({
      mode: 'authored',
      matches: expect.arrayContaining([{ judgmentId: reference.id, state: 'different' }]),
    });
  });

  it('keeps advanced cases substantial and exposes authored reference judgments only for unchanged fiction', () => {
    expect(advancedCases).toHaveLength(3);
    for (const item of advancedCases) {
      expect(item.sources.length).toBeGreaterThanOrEqual(4);
      expect(item.sources.length).toBeLessThanOrEqual(6);
      expect(item.reference.judgments.length).toBeGreaterThanOrEqual(5);
      expect(item.draft.length).toBeGreaterThan(260);
      expect(new Set(item.sources.map((source) => source.id)).size).toBe(item.sources.length);
    }

    const authored = createWorkroomFromCase(advancedCases[0]!.id);
    expect(evaluateAuthoredCase(authored)).toMatchObject({ mode: 'authored', available: true });
    const ownRevision = applyContentChange(authored, { draft: `${authored.draft}\nA local note.` });
    expect(evaluateAuthoredCase(ownRevision)).toMatchObject({ mode: 'manual', available: false });
  });
});
