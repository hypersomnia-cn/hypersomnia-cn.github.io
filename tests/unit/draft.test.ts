import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateAssessmentRoute,
  getAssessmentDraft,
  getServerDraft,
  initializeDraft,
  subscribeDraft,
  updateDraft,
} from '../../src/lib/assessment-draft';
import { readScale } from '../../src/lib/content';
beforeEach(() => activateAssessmentRoute(null));
describe('in-memory assessment lifecycle', () => {
  const scale = readScale('ess');
  it('preserves answers, errors and result when the logical scale stays the same', () => {
    initializeDraft(scale);
    const result = {
      scaleId: scale.id,
      contentVersion: scale.contentVersion,
      scoringVersion: scale.scoringVersion,
      total: 0,
      components: {},
      interpretationId: scale.bands[0].id,
    };
    updateDraft(scale, { answers: { q1: '0' }, errors: { q2: 'invalid' }, result });
    const before = getAssessmentDraft();
    activateAssessmentRoute('ess');
    expect(initializeDraft(scale)).toBe(before);
    expect(getServerDraft()).toBeNull();
  });
  it('clears on leaving, changing scale and changing version', () => {
    initializeDraft(scale);
    updateDraft(scale, { answers: { q1: '0' } });
    activateAssessmentRoute(null);
    expect(getAssessmentDraft()).toBeNull();
    expect(initializeDraft(scale).answers).toEqual({});
    updateDraft(scale, { answers: { q1: '0' } });
    expect(initializeDraft({ ...scale, scoringVersion: 'changed' }).answers).toEqual({});
    activateAssessmentRoute('fss');
    expect(getAssessmentDraft()).toBeNull();
    updateDraft(scale, { answers: { q1: '3' } });
    expect(getAssessmentDraft()).toBeNull();
  });
  it('copies answers and notifies only active subscribers', () => {
    let updates = 0;
    const unsubscribe = subscribeDraft(() => updates++);
    initializeDraft(scale);
    const answers = { q1: '0' };
    updateDraft(scale, { answers });
    answers.q1 = '3';
    expect(getAssessmentDraft()?.answers.q1).toBe('0');
    expect(updates).toBeGreaterThan(0);
    unsubscribe();
    const previous = updates;
    activateAssessmentRoute(null);
    expect(updates).toBe(previous);
  });
});
