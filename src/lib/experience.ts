export type ProjectKind = 'all' | 'privacy' | 'security' | 'learning' | 'experiments';

export interface PortfolioProject {
  title: string;
  kind: Exclude<ProjectKind, 'all'>;
  description: string;
  href?: string;
  status: string;
}

export const projects: PortfolioProject[] = [
  {
    title: 'PhishSniper',
    kind: 'security',
    description: 'Security awareness and phishing simulation.',
    href: 'https://phishsniper.io',
    status: 'External site',
  },
  {
    title: 'DPDP field notes',
    kind: 'privacy',
    description:
      'A source directory and comparison methodology for privacy research. Educational preview.',
    href: 'https://dpdp-best-preview.pages.dev/',
    status: 'Concept preview',
  },
  {
    title: 'DPDP evidence hub',
    kind: 'privacy',
    description:
      'A concept space for DPDP education and evidence trails; it makes no compliance claims.',
    href: 'https://dpdphq-com-preview.pages.dev/',
    status: 'Concept preview',
  },
  {
    title: 'Signal School',
    kind: 'learning',
    description: 'A hands-on prompt practice studio with clear, deterministic coaching.',
    href: '/signal-school',
    status: 'Local experience',
  },
  ...[
    ['Email hack checker', 'Explore whether an email address appears in known exposure records.'],
    ['SPF checker', 'Inspect the SPF record published for a domain.'],
    ['Phishing URL checker', 'Inspect a URL for phishing-related signals.'],
    ['DKIM checker', 'Explore a domain’s DKIM record.'],
    ['DMARC checker', 'Inspect the DMARC record published for a domain.'],
    ['TXT checker', 'Explore TXT records for a domain.'],
    ['MX checker', 'Inspect mail exchange records for a domain.'],
    ['AAAA checker', 'Explore IPv6 AAAA records for a domain.'],
  ].map(([title, description]) => ({
    title,
    kind: 'security' as const,
    description,
    href: `https://phishsniper.io/free-tools/${title.toLowerCase().replaceAll(' ', '-')}`,
    status: 'External tool',
  })),
  {
    title: 'Split Fair',
    kind: 'experiments',
    description: 'A small browser tool for sharing a total and handling the remainder clearly.',
    href: 'https://jugaad-best-preview.pages.dev/tools/split-fair',
    status: 'Preview tool',
  },
  {
    title: 'Text Tidy',
    kind: 'experiments',
    description:
      'A browser tool for cleaning repeated lines and making pasted text easier to work with.',
    href: 'https://jugaad-best-preview.pages.dev/tools/text-tidy',
    status: 'Preview tool',
  },
  {
    title: 'Time Bridge',
    kind: 'experiments',
    description: 'A lightweight way to compare time zones before asking people to meet.',
    href: 'https://jugaad-best-preview.pages.dev/tools/time-bridge',
    status: 'Preview tool',
  },
];

export function filterProjects(kind: ProjectKind | string) {
  return kind === 'all' ? projects : projects.filter((project) => project.kind === kind);
}

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
