import { describe, expect, it } from 'vitest';

import {
  buildPrompt,
  completeFinalChallenge,
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

  it('only awards final XP after all six known lessons are complete and only once', () => {
    expect(completeFinalChallenge(initialCourseProgress)).toEqual(initialCourseProgress);
    const completed = courseLessons.reduce(
      (progress, lesson) => markLessonComplete(progress, lesson.id),
      initialCourseProgress,
    );
    const awarded = completeFinalChallenge(completed);
    expect(awarded.xp).toBe(440);
    expect(completeFinalChallenge(awarded)).toEqual(awarded);
    const duplicate = completeFinalChallenge({
      ...completed,
      completed: [...completed.completed, 'brief'],
    });
    expect(duplicate.finalComplete).toBe(false);
    expect(duplicate.xp).toBe(360);
  });

  it('names the failure mode when an exercise choice misses the brief', () => {
    const exercise = courseLessons.find((item) => item.id === 'evidence');
    expect(exercise).toBeDefined();
    const result = evaluateExercise(exercise!, 'publish-all');
    expect(result.correct).toBe(false);
    expect(result.failureMode).toMatch(/claim the notes do not support/i);
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
    expect(buildPrompt(parts)).toContain('Who it is for: A project partner');
    expect(buildPrompt({ ...parts, task: '' })).toBe('');
  });
});
