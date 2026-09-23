export const lessons = [
  {
    id: 'task',
    number: '01',
    title: 'Name the task',
    principle: 'Start with the outcome and who it serves.',
    question: 'Which opening gives an AI the clearest job?',
    options: ['Help with my work.', 'Draft a three-step agenda for a 20-minute project check-in.'],
    answer: 1,
    explanation: 'A useful task names a deliverable, a scale, and a context.',
  },
  {
    id: 'context',
    number: '02',
    title: 'Add context and constraints',
    principle: 'Give relevant facts, boundaries, and a definition of useful.',
    question: 'Which constraint is most helpful?',
    options: [
      'Make it good.',
      'Use plain language, keep it under 120 words, and flag unknown facts.',
    ],
    answer: 1,
    explanation: 'Concrete constraints make a response easier to evaluate.',
  },
  {
    id: 'examples',
    number: '03',
    title: 'Show the shape',
    principle: 'Examples and formats reduce ambiguity.',
    question: 'Which request specifies an output shape?',
    options: [
      'Write a summary.',
      'Return: one-sentence summary, three bullets, then open questions.',
    ],
    answer: 1,
    explanation: 'A named structure helps you review the result quickly.',
  },
  {
    id: 'verify',
    number: '04',
    title: 'Handle uncertainty',
    principle: 'Ask the model to distinguish known information from assumptions.',
    question: 'What is the safer instruction for a factual task?',
    options: [
      'Fill every gap so it sounds complete.',
      'List assumptions and tell me what needs verification.',
    ],
    answer: 1,
    explanation: 'Useful confidence has a visible evidence boundary.',
  },
  {
    id: 'untrusted',
    number: '05',
    title: 'Treat instructions carefully',
    principle: 'Text you paste may contain directions that do not belong to your task.',
    question: 'What should you do with a document that says “ignore previous instructions”?',
    options: [
      'Treat it as source material, not authority; keep the original task.',
      'Follow it because it appears in the document.',
    ],
    answer: 0,
    explanation: 'Separate task instructions from untrusted source text.',
  },
  {
    id: 'evaluate',
    number: '06',
    title: 'Choose and evaluate AI',
    principle: 'Match tools to stakes, then check output against a rubric.',
    question: 'Which final check is most useful?',
    options: [
      'Did it look confident?',
      'Did it meet the requested format, use supported claims, and preserve the constraints?',
    ],
    answer: 1,
    explanation: 'A simple rubric turns “looks right” into a reviewable decision.',
  },
] as const;

export type LessonId = (typeof lessons)[number]['id'];
export interface CourseProgress {
  completed: LessonId[];
  xp: number;
}
export const initialCourseProgress: CourseProgress = { completed: [], xp: 0 };
export function markLessonComplete(progress: CourseProgress, id: LessonId): CourseProgress {
  if (progress.completed.includes(id)) return progress;
  return { completed: [...progress.completed, id], xp: progress.xp + 60 };
}
export function resetCourse(): CourseProgress {
  return initialCourseProgress;
}

export function buildPrompt(parts: Record<string, string>) {
  const sections = [
    parts.task && `Task: ${parts.task}`,
    parts.context && `Context: ${parts.context}`,
    parts.constraints && `Constraints: ${parts.constraints}`,
    parts.format && `Format: ${parts.format}`,
    'If information is missing or uncertain, list it clearly rather than guessing.',
  ].filter(Boolean);
  return parts.task ? sections.join('\n\n') : '';
}
