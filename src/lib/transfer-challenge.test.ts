import { describe, expect, it } from 'vitest';

import {
  blankTransferAnswers,
  type CaseId,
  evaluateTransferCase,
  transferCases,
  type TransferAnswers,
} from './transfer-challenge';

function complete(caseId: 'equipment' | 'exhibition' | 'garden'): TransferAnswers {
  const answers = blankTransferAnswers(caseId);
  if (caseId === 'equipment') {
    answers.claims['pickup-time'] = { status: 'contradicted', sources: ['S2'] };
    answers.claims.reference = { status: 'supported', sources: ['S2'] };
    answers.claims.adapter = { status: 'contradicted', sources: ['S3'] };
    answers.handoff = { optionId: 'handoff-a', sources: ['B'] };
  }
  if (caseId === 'exhibition') {
    answers.claims.doors = { status: 'sources-disagree', sources: ['S2', 'S1'] };
    answers.claims.venue = { status: 'supported', sources: ['S2'] };
    answers.claims.lunch = { status: 'not-established', sources: ['S3'] };
    answers.handoff = { optionId: 'handoff-b', sources: ['B'] };
  }
  if (caseId === 'garden') {
    answers.claims.location = { status: 'supported', sources: ['S1'] };
    answers.claims.weather = { status: 'not-established', sources: ['S2'] };
    answers.claims.gloves = { status: 'contradicted', sources: ['S1'] };
    answers.handoff = { optionId: 'handoff-c', sources: ['B', 'S3'] };
  }
  return answers;
}

describe('transfer challenge evaluator', () => {
  it('accepts all three authored reference decisions', () => {
    for (const caseId of ['equipment', 'exhibition', 'garden'] as const) {
      expect(evaluateTransferCase(caseId, complete(caseId)).pass).toBe(true);
    }
  });

  it('accepts either direct exhibition venue source and source order does not matter', () => {
    const answers = complete('exhibition');
    answers.claims.venue.sources = ['S1'];
    expect(evaluateTransferCase('exhibition', answers).pass).toBe(true);
    answers.claims.venue.sources = ['S3'];
    expect(evaluateTransferCase('exhibition', answers).claims.venue.references).toEqual([
      'S1',
      'S2',
    ]);
  });

  it('distinguishes missing answers from an answer needing review', () => {
    const empty = evaluateTransferCase('equipment', blankTransferAnswers('equipment'));
    expect(empty.claims['pickup-time'].state).toBe('missing');
    const wrong = complete('equipment');
    wrong.claims['pickup-time'].status = 'supported';
    expect(evaluateTransferCase('equipment', wrong).claims['pickup-time'].state).toBe(
      'needs-review',
    );
    expect(evaluateTransferCase('equipment', wrong).claims['pickup-time'].references).toEqual([
      'S2',
    ]);
  });

  it('rejects partial, duplicate, unknown, cross-case and sentinel-mixed evidence', () => {
    const partial = complete('equipment');
    partial.claims.reference.sources = [];
    expect(evaluateTransferCase('equipment', partial).pass).toBe(false);
    const duplicate = complete('equipment');
    duplicate.claims.reference.sources = ['S2', 'S2'];
    expect(evaluateTransferCase('equipment', duplicate).pass).toBe(false);
    const unknown = complete('equipment');
    unknown.claims.reference.sources = ['S99'];
    expect(evaluateTransferCase('equipment', unknown).pass).toBe(false);
    const crossCase = complete('equipment');
    crossCase.claims.reference.sources = ['S1'];
    expect(evaluateTransferCase('equipment', crossCase).pass).toBe(false);
    const sentinel = complete('garden');
    sentinel.claims.weather.sources = ['no-source', 'S2'];
    expect(evaluateTransferCase('garden', sentinel).pass).toBe(false);
  });

  it('rejects extra and foreign claim keys and unknown runtime case IDs without throwing', () => {
    const extra = complete('equipment');
    extra.claims.intruder = { status: 'supported', sources: ['S1'] };
    expect(evaluateTransferCase('equipment', extra).pass).toBe(false);
    const foreign = complete('equipment');
    foreign.claims.doors = { status: 'sources-disagree', sources: ['S1', 'S2'] };
    expect(evaluateTransferCase('equipment', foreign).pass).toBe(false);
    expect(() => evaluateTransferCase('unknown' as CaseId, complete('equipment'))).not.toThrow();
    expect(evaluateTransferCase('unknown' as CaseId, complete('equipment')).pass).toBe(false);
  });

  it('requires the required handoff citations and does not mutate answers', () => {
    const answers = complete('garden');
    const before = structuredClone(answers);
    answers.handoff.sources = ['B'];
    expect(evaluateTransferCase('garden', answers).handoff.state).toBe('needs-review');
    evaluateTransferCase('garden', before);
    expect(before).toEqual(complete('garden'));
  });

  it('keeps source instructions as source text rather than commands', () => {
    const garden = transferCases.find((item) => item.id === 'garden');
    expect(garden?.sources.find((source) => source.id === 'S3')?.text).toMatch(
      /Ignore the draft-only/i,
    );
    expect(garden?.request.id).toBe('B');
  });
});
