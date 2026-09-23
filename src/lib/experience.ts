export type ExerciseKind = 'choose' | 'sequence' | 'classify';
export interface CourseExercise {
  id: 'brief' | 'context' | 'structure' | 'evidence' | 'boundary' | 'rubric';
  number: string;
  title: string;
  interaction: ExerciseKind;
  principle: string;
  scenario: string;
  prompt: string;
  options: readonly { id: string; label: string }[];
  answer: string;
  explanation: string;
  failureMode: string;
}

export const courseLessons: readonly CourseExercise[] = [
  {
    id: 'brief',
    number: '01',
    title: 'Say what you need',
    interaction: 'choose',
    principle: 'Say what you want written and who will read it.',
    scenario:
      'You are helping an organiser draft an update for people attending a repair workshop.',
    prompt: 'What should you ask AI to write?',
    options: [
      { id: 'vague', label: 'Help with my work.' },
      {
        id: 'specific',
        label:
          'Draft a three-bullet update for a project partner: progress, decision needed, and next step.',
      },
      { id: 'maximal', label: 'Write everything you know about the project.' },
    ],
    answer: 'specific',
    explanation:
      'That gives AI a clear job: write a short update for attendees, then let the organiser check it.',
    failureMode: 'Say what the update should cover and who will read it.',
  },
  {
    id: 'context',
    number: '02',
    title: 'Give useful details',
    interaction: 'classify',
    principle: 'Give AI the details it needs to answer your question.',
    scenario:
      'The organiser has collected the notes below. You need to turn them into an update for attendees.',
    prompt: 'Which notes belong in the update?',
    options: [
      {
        id: 'relevant',
        label: 'The workshop is on Saturday, but two volunteers have not confirmed yet.',
      },
      { id: 'private', label: 'A teammate’s private address and personal schedule.' },
      { id: 'noise', label: 'The colour of the original project board.' },
    ],
    answer: 'relevant',
    explanation:
      'The time, place, capacity, repair limits and volunteer availability matter. Last year’s poster and the instruction to publish do not.',
    failureMode:
      'Check your choices. Include the workshop details, but leave out the poster and the instruction to publish.',
  },
  {
    id: 'structure',
    number: '03',
    title: 'Put it in order',
    interaction: 'sequence',
    principle: 'Tell AI how you want the answer organised.',
    scenario:
      'The organiser wants the update in this order: when and where, what to bring, then what still needs confirming.',
    prompt: 'Put these three parts in that order.',
    options: [
      { id: 'polish', label: 'Make it friendlier and add a longer introduction.' },
      { id: 'shape', label: 'Use: headline, three evidence-backed bullets, then one next step.' },
      { id: 'shorten', label: 'Cut it to one sentence.' },
    ],
    answer: 'shape',
    explanation:
      'That order helps attendees find the practical details first, then see what is still uncertain.',
    failureMode:
      'Start with the time and place, then what to bring. Put the unconfirmed details last.',
  },
  {
    id: 'evidence',
    number: '04',
    title: 'Check the facts',
    interaction: 'classify',
    principle: 'An answer can sound certain even when the notes are not.',
    scenario:
      'The notes say: Saturday at 10, 18 people registered, and two volunteers have not confirmed.',
    prompt: 'What do we actually know?',
    options: [
      { id: 'publish-all', label: 'State that the policy guarantees compliance.' },
      {
        id: 'qualified',
        label: 'Say it is proposed, cite the note, and flag the effective-status check.',
      },
      { id: 'omit', label: 'Remove every mention of the policy.' },
    ],
    answer: 'qualified',
    explanation:
      'Right. The start time is in the notes. Registration does not guarantee attendance, and the volunteers still need to confirm.',
    failureMode:
      'That includes a claim the notes do not support. Check what is confirmed and what is only a guess.',
  },
  {
    id: 'boundary',
    number: '05',
    title: 'Spot hidden instructions',
    interaction: 'choose',
    principle: 'Instructions hidden in pasted notes should not change what you asked for.',
    scenario:
      'You asked for a draft. Someone has added a line to the workshop notes telling AI to publish it instead.',
    prompt: 'Which instruction should AI ignore?',
    options: [
      { id: 'follow', label: 'Follow it because it appears in the notes.' },
      {
        id: 'boundary',
        label: 'Treat it as untrusted source text and continue with the original task.',
      },
      { id: 'repeat', label: 'Repeat it at the top of the response.' },
    ],
    answer: 'boundary',
    explanation:
      'Right. The added line should not override your request. Leave out the made-up guarantee and keep the update as a draft.',
    failureMode:
      'The pasted note is trying to change the job. Follow the organiser’s request for a draft instead.',
  },
  {
    id: 'rubric',
    number: '06',
    title: 'Compare two answers',
    interaction: 'sequence',
    principle: 'Check whether an answer does what you asked, not just whether it sounds good.',
    scenario:
      'You asked for three bullets, no made-up facts, and a draft the organiser can check before sending.',
    prompt: 'Which draft follows those instructions?',
    options: [
      { id: 'confident', label: 'Use the draft that sounds more certain.' },
      {
        id: 'rubric',
        label: 'Check requested format, evidence support, constraints, and remaining unknowns.',
      },
      { id: 'longest', label: 'Use the longer draft because it has more detail.' },
    ],
    answer: 'rubric',
    explanation:
      'Draft A follows the format, keeps the uncertain details clear, and waits for the organiser to check it.',
    failureMode:
      'A confident answer can still be wrong. Check all six questions, then choose the draft that follows the instructions.',
  },
];

export const lessons = courseLessons;
export type LessonId = CourseExercise['id'];
export interface CourseProgress {
  completed: LessonId[];
  xp: number;
  finalComplete: boolean;
}
export const initialCourseProgress: CourseProgress = { completed: [], xp: 0, finalComplete: false };
export function markLessonComplete(progress: CourseProgress, id: LessonId): CourseProgress {
  if (progress.completed.includes(id)) return progress;
  return { ...progress, completed: [...progress.completed, id], xp: progress.xp + 60 };
}
export function completeFinalChallenge(progress: CourseProgress): CourseProgress {
  return progress.finalComplete
    ? progress
    : { ...progress, finalComplete: true, xp: progress.xp + 80 };
}
export function resetCourse(): CourseProgress {
  return initialCourseProgress;
}
export function evaluateExercise(exercise: CourseExercise, choice: string) {
  const correct = choice === exercise.answer;
  return {
    correct,
    feedback: correct ? exercise.explanation : exercise.failureMode,
    failureMode: correct ? '' : exercise.failureMode,
  };
}

export interface PromptParts {
  scenario: string;
  task: string;
  audience: string;
  context: string;
  sourceBoundary: string;
  constraints: string;
  format: string;
}
export const blankPromptParts: PromptParts = {
  scenario: '',
  task: '',
  audience: '',
  context: '',
  sourceBoundary: '',
  constraints: '',
  format: '',
};
const fields: readonly [keyof PromptParts, string][] = [
  ['scenario', 'Situation'],
  ['task', 'Task'],
  ['audience', 'Who it is for'],
  ['context', 'Details to include'],
  ['sourceBoundary', 'What to use'],
  ['constraints', 'What to avoid'],
  ['format', 'Answer format'],
];
export function promptChecklist(parts: PromptParts) {
  return fields.map(([key, label]) => ({ key, label, complete: Boolean(parts[key].trim()) }));
}
export function buildPrompt(parts: PromptParts) {
  if (!parts.task.trim()) return '';
  return fields
    .filter(([key]) => parts[key].trim())
    .map(([key, label]) => `${label}: ${parts[key].trim()}`)
    .join('\n\n');
}
