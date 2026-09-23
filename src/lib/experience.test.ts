import { describe, expect, it } from 'vitest';

import {
  initialCourseProgress,
  markLessonComplete,
  resetCourse,
  buildPrompt,
  lessons,
} from './experience';

describe('Signal School progress', () => {
  it('awards XP only once for the same lesson', () => {
    const once = markLessonComplete(initialCourseProgress, 'task');
    const twice = markLessonComplete(once, 'task');
    expect(once.xp).toBe(60);
    expect(twice).toEqual(once);
  });

  it('resets every completion and XP total', () => {
    expect(resetCourse()).toEqual(initialCourseProgress);
  });

  it('keeps the injection lesson’s safe answer ahead of the unsafe instruction', () => {
    const lesson = lessons.find((item) => item.id === 'untrusted');
    expect(lesson?.answer).toBe(0);
    expect(lesson?.options[lesson.answer]).toMatch(/source material/i);
  });

  it('does not generate a prompt until a task is supplied', () => {
    expect(buildPrompt({ task: '', context: '', constraints: '', format: '' })).toBe('');
  });
});
