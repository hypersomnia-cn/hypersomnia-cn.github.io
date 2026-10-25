import type { Answers, AssessmentResult, Scale } from './schema';
import type { ValidationCode } from './scoring';
import type { ScaleId } from './scale-id';
export type AssessmentDraft = {
  scaleId: ScaleId;
  contentVersion: string;
  scoringVersion: string;
  answers: Answers;
  result: AssessmentResult | null;
  errors: Record<string, ValidationCode>;
};
let activeScale: ScaleId | null = null;
let draft: AssessmentDraft | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
export const getAssessmentDraft = () => draft;
export const getServerDraft = () => null;
export function subscribeDraft(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function activateAssessmentRoute(scaleId: ScaleId | null) {
  if (activeScale !== scaleId) {
    activeScale = scaleId;
    draft = null;
    notify();
  }
}
export function matchesDraft(
  value: AssessmentDraft | null,
  scale: Pick<Scale, 'id' | 'contentVersion' | 'scoringVersion'>,
): value is AssessmentDraft {
  return (
    value?.scaleId === scale.id &&
    value.contentVersion === scale.contentVersion &&
    value.scoringVersion === scale.scoringVersion
  );
}
// Writes occur only in browser effects and events; static rendering always uses an empty snapshot.
export function initializeDraft(scale: Pick<Scale, 'id' | 'contentVersion' | 'scoringVersion'>) {
  activateAssessmentRoute(scale.id);
  if (!matchesDraft(draft, scale)) {
    draft = {
      scaleId: scale.id,
      contentVersion: scale.contentVersion,
      scoringVersion: scale.scoringVersion,
      answers: {},
      result: null,
      errors: {},
    };
    notify();
  }
  return draft!;
}
export function updateDraft(
  scale: Pick<Scale, 'id' | 'contentVersion' | 'scoringVersion'>,
  patch: Partial<Pick<AssessmentDraft, 'answers' | 'result' | 'errors'>>,
) {
  if (activeScale !== scale.id || !matchesDraft(draft, scale)) return;
  draft = { ...draft, ...patch, ...(patch.answers ? { answers: { ...patch.answers } } : {}) };
  notify();
}
