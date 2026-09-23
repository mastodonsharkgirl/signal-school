import { describe, expect, it } from 'vitest';

import {
  buildPrompt,
  courseLessons,
  evaluateExercise,
  initialCourseProgress,
  markLessonComplete,
  promptChecklist,
  resetCourse,
} from './experience';

describe('Signal School progress', () => {
  it('awards XP only once for the same lesson', () => {
    const once = markLessonComplete(initialCourseProgress, 'brief');
    const twice = markLessonComplete(once, 'brief');
    expect(once.xp).toBe(60);
    expect(twice).toEqual(once);
  });

  it('resets every completion and XP total', () => {
    expect(resetCourse()).toEqual(initialCourseProgress);
  });

  it('names the failure mode when an exercise choice misses the brief', () => {
    const exercise = courseLessons.find((item) => item.id === 'evidence');
    expect(exercise).toBeDefined();
    const result = evaluateExercise(exercise!, 'publish-all');
    expect(result.correct).toBe(false);
    expect(result.failureMode).toMatch(/unsupported claim/i);
  });

  it('builds a prompt and marks only supplied brief fields as complete', () => {
    const parts = {
      scenario: 'Project update',
      task: 'Draft an update',
      audience: 'A project partner',
      context: '',
      sourceBoundary: 'Use only the notes below',
      constraints: '',
      format: 'Three bullets',
    };
    expect(promptChecklist(parts).map((item) => item.complete)).toEqual([
      true,
      true,
      true,
      false,
      true,
      false,
      true,
    ]);
    expect(buildPrompt(parts)).toContain('Audience: A project partner');
    expect(buildPrompt({ ...parts, task: '' })).toBe('');
  });
});
