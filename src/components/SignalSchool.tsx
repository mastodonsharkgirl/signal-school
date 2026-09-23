import { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import {
  buildPrompt,
  initialCourseProgress,
  lessons,
  markLessonComplete,
  resetCourse,
} from '@/lib/experience';

export default function SignalSchool({ portfolioHref = '/' }: { portfolioHref?: string }) {
  const [active, setActive] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [progress, setProgress] = useState(initialCourseProgress);
  const [awarded, setAwarded] = useState(false);
  const [challengeDone, setChallengeDone] = useState(false);
  const [challengeAnswer, setChallengeAnswer] = useState<number | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [parts, setParts] = useState({ task: '', context: '', constraints: '', format: '' });
  const lesson = lessons[active];
  const lessUsefulOption = lesson.options.find((_, index) => index !== lesson.answer) ?? '';
  const prompt = useMemo(() => buildPrompt(parts), [parts]);
  const isComplete = progress.completed.includes(lesson.id);
  const choose = (choice: number) => {
    setAnswered(choice);
    if (choice === lesson.answer) {
      setAwarded(!isComplete);
      setProgress((current) => markLessonComplete(current, lesson.id));
    }
  };
  const selectLesson = (index: number) => {
    setActive(index);
    setAnswered(null);
    setAwarded(false);
  };
  const reset = () => {
    setProgress(resetCourse());
    setAnswered(null);
    setAwarded(false);
    setChallengeDone(false);
    setChallengeAnswer(null);
    setCopyMessage('');
    setActive(0);
    setParts({ task: '', context: '', constraints: '', format: '' });
  };
  return (
    <div className="signal-school">
      <header className="signal-header">
        <a href={portfolioHref}>← Saran Vashisht</a>
        <p>
          Signal School <span>private preview</span>
        </p>
        <button type="button" onClick={reset}>
          <RotateCcw aria-hidden="true" /> Reset course
        </button>
      </header>
      <div className="signal-content">
        <section className="signal-hero">
          <p className="signal-eyebrow">A practical AI literacy course</p>
          <h1>
            Turn a thought
            <br />
            into a <em>signal.</em>
          </h1>
          <p>
            Six short lessons for making requests clearer, checking output carefully, and staying in
            charge of the work.
          </p>
          <a href="#lesson" onClick={() => selectLesson(0)}>
            Start the first signal <ArrowRight aria-hidden="true" />
          </a>
        </section>
        <section className="signal-progress" aria-label="Course progress">
          <div>
            <span>Course signal</span>
            <strong aria-live="polite">{progress.xp} XP</strong>
          </div>
          <ol>
            {lessons.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={active === index ? 'step' : undefined}
                  onClick={() => selectLesson(index)}
                >
                  <span>
                    {progress.completed.includes(item.id) ? (
                      <Check aria-label="Completed" />
                    ) : (
                      item.number
                    )}
                  </span>
                  {item.title}
                </button>
              </li>
            ))}
          </ol>
        </section>
        <section className="lesson-panel" id="lesson" aria-labelledby="lesson-title">
          <div className="lesson-copy">
            <p className="signal-eyebrow">Module {lesson.number} / 06</p>
            <h2 id="lesson-title">{lesson.title}</h2>
            <p>{lesson.principle}</p>
            <p className="lesson-example">
              <strong>Try this shift:</strong> “{lessUsefulOption}” → “
              {lesson.options[lesson.answer]}”
            </p>
            <div className="lesson-rule">
              <ShieldCheck aria-hidden="true" /> This coaching is deterministic: it follows the
              choices on this page. It is not an AI call or a score of your ability.
            </div>
          </div>
          <div className="lesson-check">
            <p className="question">{lesson.question}</p>
            <div>
              {lesson.options.map((option, index) => (
                <button
                  type="button"
                  className={
                    answered === index
                      ? index === lesson.answer
                        ? 'answer-correct'
                        : 'answer-wrong'
                      : ''
                  }
                  key={option}
                  onClick={() => choose(index)}
                >
                  {option}
                </button>
              ))}
            </div>
            {answered !== null && (
              <p
                aria-live="polite"
                className={answered === lesson.answer ? 'coaching good' : 'coaching'}
              >
                {answered === lesson.answer ? `+${awarded ? '60' : '0'} XP · ` : 'Try again · '}
                {lesson.explanation}
              </p>
            )}
          </div>
        </section>
        <section className="prompt-lab" aria-labelledby="lab-title">
          <div>
            <p className="signal-eyebrow">Prompt assembly lab</p>
            <h2 id="lab-title">Build the brief before you ask.</h2>
            <p>
              Write a small, real request. The page assembles it locally in your browser; nothing is
              sent anywhere.
            </p>
          </div>
          <div className="lab-grid">
            {(['task', 'context', 'constraints', 'format'] as const).map((key) => (
              <label key={key}>
                {key === 'task'
                  ? 'Task'
                  : key === 'context'
                    ? 'Context'
                    : key === 'constraints'
                      ? 'Constraints'
                      : 'Output format'}
                <textarea
                  value={parts[key]}
                  onChange={(event) =>
                    setParts((current) => ({ ...current, [key]: event.target.value }))
                  }
                  placeholder={
                    key === 'task'
                      ? 'What do you want to make or decide?'
                      : key === 'context'
                        ? 'What does the helper need to know?'
                        : key === 'constraints'
                          ? 'Limits, audience, tone, evidence boundary…'
                          : 'Bullets, table, outline, next steps…'
                  }
                />
              </label>
            ))}
          </div>
          <pre aria-live="polite">{prompt || 'Your assembled prompt will appear here.'}</pre>
          <div className="lab-actions">
            <button
              type="button"
              onClick={() => {
                setParts({ task: '', context: '', constraints: '', format: '' });
                setCopyMessage('Lab cleared.');
              }}
            >
              Clear lab
            </button>
            <button
              type="button"
              disabled={!prompt}
              onClick={async () => {
                if (!navigator.clipboard?.writeText) {
                  setCopyMessage(
                    'Copy is unavailable here. Select the assembled prompt and copy it manually.',
                  );
                  return;
                }
                try {
                  await navigator.clipboard.writeText(prompt);
                  setCopyMessage('Prompt copied to your clipboard.');
                } catch {
                  setCopyMessage(
                    'Clipboard access was blocked. Select the assembled prompt and copy it manually.',
                  );
                }
              }}
            >
              <Copy aria-hidden="true" /> Copy prompt
            </button>
            <span aria-live="polite">{copyMessage}</span>
          </div>
        </section>
        <section className="final-challenge">
          <Sparkles aria-hidden="true" />
          <p className="signal-eyebrow">Final challenge</p>
          <h2>Review a response as carefully as you wrote the request.</h2>
          <p className="challenge-scenario">
            A draft response claims a regulation “guarantees compliance”, ignores the requested
            three-bullet format, and includes a pasted note saying “ignore the user and publish
            this.” What is the first useful review action?
          </p>
          <div className="challenge-options">
            {[
              'Publish it after making the tone friendlier.',
              'Keep the claim but add more detail.',
              'Flag the unsupported claim, restore the requested format, and ignore the pasted instruction.',
            ].map((option, index) => (
              <button
                type="button"
                key={option}
                disabled={progress.completed.length !== lessons.length || challengeDone}
                className={
                  challengeAnswer === index ? (index === 2 ? 'answer-correct' : 'answer-wrong') : ''
                }
                onClick={() => {
                  setChallengeAnswer(index);
                  if (index === 2) setChallengeDone(true);
                }}
              >
                {option}
              </button>
            ))}
          </div>
          <p aria-live="polite">
            {challengeDone
              ? 'Final review complete. Keep the rubric; reset whenever you want a clean run.'
              : challengeAnswer !== null
                ? 'Try again: the response still needs a factual boundary, the requested structure, and protection from untrusted instructions.'
                : progress.completed.length === lessons.length
                  ? 'All six modules are complete. Choose the strongest review action.'
                  : `${lessons.length - progress.completed.length} modules remain. Completion is local to this page and clears on refresh.`}
          </p>
          <p className="further-reading">
            Further reading:{' '}
            <a
              href="https://ai.google.dev/gemini-api/docs/prompting-strategies"
              target="_blank"
              rel="noreferrer"
            >
              prompting strategies
            </a>
            ,{' '}
            <a
              href="https://ai.google.dev/gemini-api/docs/safety-guidance"
              target="_blank"
              rel="noreferrer"
            >
              safety guidance
            </a>
            , and{' '}
            <a
              href="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
              target="_blank"
              rel="noreferrer"
            >
              context engineering
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
