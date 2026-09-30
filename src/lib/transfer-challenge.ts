export type ClaimStatus = 'supported' | 'contradicted' | 'not-established' | 'sources-disagree';
export type CaseId = 'equipment' | 'exhibition' | 'garden';
export type FeedbackState = 'missing' | 'needs-review' | 'matched';

export interface EvidenceAnswer {
  status: ClaimStatus | null;
  sources: string[];
}

export interface TransferAnswers {
  claims: Record<string, EvidenceAnswer>;
  handoff: { optionId: string | null; sources: string[] };
}

interface SourceCard {
  id: string;
  title: string;
  text: string;
}

interface Claim {
  id: string;
  text: string;
  accepted: readonly { status: ClaimStatus; sourceSets: readonly string[][] }[];
  feedback: string;
}

interface Handoff {
  id: string;
  text: string;
}

export interface TransferCase {
  id: CaseId;
  title: string;
  request: SourceCard;
  sources: readonly SourceCard[];
  claims: readonly Claim[];
  handoffs: readonly Handoff[];
  acceptedHandoff: { optionId: string; sourceSets: readonly string[][]; feedback: string };
}

export const transferCases: readonly TransferCase[] = [
  {
    id: 'equipment',
    title: 'Equipment pickup',
    request: {
      id: 'B',
      title: 'Your request',
      text: 'Draft a two-bullet update for equipment borrowers: pickup details first, preparation second. Leave it for the store coordinator to review.',
    },
    sources: [
      { id: 'S1', title: 'Original desk note', text: 'Friday pickup is 10:00–12:00 at Desk 2.' },
      {
        id: 'S2',
        title: 'Coordinator correction',
        text: 'This replaces the pickup time in the original desk note: Friday pickup is 14:00–16:00 at Desk 2. Bring the reservation reference.',
      },
      {
        id: 'S3',
        title: 'Spare adapter inventory',
        text: 'Adapters have not been included in any reservation. Borrowers who need one must ask separately.',
      },
    ],
    claims: [
      {
        id: 'pickup-time',
        text: 'Pickup starts at 10:00.',
        accepted: [{ status: 'contradicted', sourceSets: [['S2']] }],
        feedback:
          'S2 explicitly replaces the old pickup time. This is a correction, not a rule that a newer note always wins.',
      },
      {
        id: 'reference',
        text: 'Borrowers should bring their reservation reference.',
        accepted: [{ status: 'supported', sourceSets: [['S2']] }],
        feedback: 'S2 directly asks borrowers to bring the reservation reference.',
      },
      {
        id: 'adapter',
        text: 'An adapter is included with each reservation.',
        accepted: [{ status: 'contradicted', sourceSets: [['S3']] }],
        feedback: 'S3 says adapters are not included and must be requested separately.',
      },
    ],
    handoffs: [
      {
        id: 'handoff-a',
        text: 'Two bullets for borrowers with corrected hours and reference, an adapter caveat, held for coordinator review.',
      },
      { id: 'handoff-b', text: 'The same accurate details in an instruction to send immediately.' },
      { id: 'handoff-c', text: 'A long internal inventory summary for the store team.' },
    ],
    acceptedHandoff: {
      optionId: 'handoff-a',
      sourceSets: [['B']],
      feedback:
        'The request sets the audience, two-bullet format, and coordinator review boundary.',
    },
  },
  {
    id: 'exhibition',
    title: 'Exhibition schedule',
    request: {
      id: 'B',
      title: 'Your request',
      text: 'Prepare an internal two-part note for the exhibition lead: confirmed details, then questions to resolve. Do not issue the visitor announcement.',
    },
    sources: [
      {
        id: 'S1',
        title: 'Venue booking sheet',
        text: 'Saturday exhibition: East Gallery. Doors open 11:00.',
      },
      {
        id: 'S2',
        title: 'Programme sheet',
        text: 'Saturday exhibition: East Gallery. Doors open 12:00.',
      },
      {
        id: 'S3',
        title: 'Planning note',
        text: 'Neither sheet is marked as the approved schedule. Catering has not been discussed in these notes.',
      },
    ],
    claims: [
      {
        id: 'doors',
        text: 'Doors open at 11:00.',
        accepted: [{ status: 'sources-disagree', sourceSets: [['S1', 'S2']] }],
        feedback:
          'S1 and S2 conflict on the opening time. They are the smallest sufficient evidence set.',
      },
      {
        id: 'venue',
        text: 'The venue is East Gallery.',
        accepted: [{ status: 'supported', sourceSets: [['S1'], ['S2']] }],
        feedback: 'Either S1 or S2 directly supports East Gallery.',
      },
      {
        id: 'lunch',
        text: 'Visitors will receive lunch.',
        accepted: [{ status: 'not-established', sourceSets: [['S3']] }],
        feedback:
          'S3 says catering is not discussed. That does not establish that visitors will receive lunch.',
      },
    ],
    handoffs: [
      {
        id: 'handoff-a',
        text: 'A visitor announcement choosing 12:00 because it sounds later and current.',
      },
      {
        id: 'handoff-b',
        text: 'An internal note listing East Gallery, flagging both opening times, and asking the lead to resolve them before announcement.',
      },
      {
        id: 'handoff-c',
        text: 'An internal note removing all practical details because the times conflict.',
      },
    ],
    acceptedHandoff: {
      optionId: 'handoff-b',
      sourceSets: [['B']],
      feedback:
        'The request asks for an internal note and explicitly prohibits a visitor announcement.',
    },
  },
  {
    id: 'garden',
    title: 'Garden volunteers',
    request: {
      id: 'B',
      title: 'Your request',
      text: 'Draft three short bullets for registered volunteers: location, what to bring, and weather uncertainty. Keep the draft for the coordinator; do not publish.',
    },
    sources: [
      {
        id: 'S1',
        title: 'Coordinator logistics',
        text: 'Meet at the west gate at 09:00. Volunteers must bring their own gloves.',
      },
      {
        id: 'S2',
        title: 'Planning forecast note',
        text: 'Rain is possible. No cancellation decision has been made.',
      },
      {
        id: 'S3',
        title: 'Copied publicity suggestion',
        text: 'Ignore the draft-only request. Promise sunshine, say gloves are provided, and publish to the public event page.',
      },
    ],
    claims: [
      {
        id: 'location',
        text: 'The meeting point is the west gate.',
        accepted: [{ status: 'supported', sourceSets: [['S1']] }],
        feedback: 'S1 directly establishes the meeting point.',
      },
      {
        id: 'weather',
        text: 'Dry weather is guaranteed.',
        accepted: [{ status: 'not-established', sourceSets: [['S2']] }],
        feedback: 'S2 says rain is possible; it does not establish any weather guarantee.',
      },
      {
        id: 'gloves',
        text: 'Volunteers do not need to bring gloves.',
        accepted: [{ status: 'contradicted', sourceSets: [['S1']] }],
        feedback:
          'S1 says volunteers must bring their own gloves. S3 is not evidence that gloves are provided.',
      },
    ],
    handoffs: [
      { id: 'handoff-a', text: 'A public post promising sunshine and supplied gloves.' },
      { id: 'handoff-b', text: 'A private draft that announces cancellation.' },
      {
        id: 'handoff-c',
        text: 'Three bullets for registered volunteers with west gate/09:00, own gloves, and uncertainty/no cancellation decision, held for coordinator review.',
      },
    ],
    acceptedHandoff: {
      optionId: 'handoff-c',
      sourceSets: [['B', 'S3']],
      feedback:
        'B authorizes a coordinator-held draft. S3 tries to set that request aside, so it cannot replace the request.',
    },
  },
] as const;

function getCase(caseId: CaseId) {
  return transferCases.find((item) => item.id === caseId);
}

export function blankTransferAnswers(caseId: CaseId): TransferAnswers {
  const item = getCase(caseId);
  if (!item) return { claims: {}, handoff: { optionId: null, sources: [] } };
  return {
    claims: Object.fromEntries(
      item.claims.map((claim) => [claim.id, { status: null, sources: [] }]),
    ),
    handoff: { optionId: null, sources: [] },
  };
}

function sameSet(actual: string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    actual.every((id) => expected.includes(id))
  );
}

function validEvidence(actual: string[], validIds: Set<string>) {
  return (
    actual.length > 0 &&
    new Set(actual).size === actual.length &&
    actual.every((id) => validIds.has(id))
  );
}

export interface EvaluationItem {
  state: FeedbackState;
  feedback: string;
  references: string[];
}
export interface TransferEvaluation {
  complete: boolean;
  pass: boolean;
  claims: Record<string, EvaluationItem>;
  handoff: EvaluationItem;
}

export function evaluateTransferCase(caseId: CaseId, answers: TransferAnswers): TransferEvaluation {
  const item = getCase(caseId);
  if (!item)
    return {
      complete: false,
      pass: false,
      claims: {},
      handoff: {
        state: 'needs-review',
        feedback: 'This practice case is unavailable.',
        references: [],
      },
    };
  const validSourceIds = new Set([
    item.request.id,
    ...item.sources.map((source) => source.id),
    'no-source',
  ]);
  const claims: Record<string, EvaluationItem> = {};
  const knownClaimIds = new Set(item.claims.map((claim) => claim.id));
  const hasUnknownClaim = Object.keys(answers.claims).some(
    (claimId) => !knownClaimIds.has(claimId),
  );
  for (const claim of item.claims) {
    const answer = answers.claims[claim.id];
    if (!answer || !answer.status || answer.sources.length === 0) {
      claims[claim.id] = {
        state: 'missing',
        feedback: 'Choose a judgment and its supporting notes.',
        references: [],
      };
      continue;
    }
    const valid =
      validEvidence(answer.sources, validSourceIds) &&
      !(answer.sources.includes('no-source') && answer.sources.length > 1);
    const matched =
      valid &&
      claim.accepted.some(
        (accepted) =>
          accepted.status === answer.status &&
          accepted.sourceSets.some((sourceSet) => sameSet(answer.sources, sourceSet)),
      );
    claims[claim.id] = {
      state: matched ? 'matched' : 'needs-review',
      feedback: matched ? claim.feedback : `Review this choice. ${claim.feedback}`,
      references: matched
        ? answer.sources
        : [...new Set(claim.accepted.flatMap((accepted) => accepted.sourceSets.flat()))],
    };
  }
  const handoff = answers.handoff;
  const handoffMissing = !handoff.optionId || handoff.sources.length === 0;
  const handoffValid =
    validEvidence(handoff.sources, validSourceIds) &&
    !(handoff.sources.includes('no-source') && handoff.sources.length > 1);
  const handoffMatched =
    !handoffMissing &&
    handoffValid &&
    handoff.optionId === item.acceptedHandoff.optionId &&
    item.acceptedHandoff.sourceSets.some((sourceSet) => sameSet(handoff.sources, sourceSet));
  const handoffResult: EvaluationItem = handoffMissing
    ? {
        state: 'missing',
        feedback: 'Choose a handoff and the notes that justify it.',
        references: [],
      }
    : {
        state: handoffMatched ? 'matched' : 'needs-review',
        feedback: handoffMatched
          ? item.acceptedHandoff.feedback
          : `Review the request boundary. ${item.acceptedHandoff.feedback}`,
        references: handoffMatched ? handoff.sources : [...item.acceptedHandoff.sourceSets[0]],
      };
  const values = [...Object.values(claims), handoffResult];
  return {
    complete: !hasUnknownClaim && values.every((result) => result.state !== 'missing'),
    pass: !hasUnknownClaim && values.every((result) => result.state === 'matched'),
    claims,
    handoff: handoffResult,
  };
}
