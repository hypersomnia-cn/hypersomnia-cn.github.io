'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { Answers, AssessmentResult, Language, Scale } from '@/lib/schema';
import type { ValidationCode } from '@/lib/scoring';
import {
  getAssessmentDraft,
  getServerDraft,
  initializeDraft,
  matchesDraft,
  subscribeDraft,
  updateDraft,
} from '@/lib/assessment-draft';
import { localizedPath, withoutBasePath } from '@/i18n/paths';
const emptyErrors: Record<string, ValidationCode> = {};
export function useAssessmentForm(scale: Scale, locale: Language) {
  const pathname = withoutBasePath(usePathname());
  const active = pathname.replace(/\/$/, '') === localizedPath(locale, `/scales/${scale.id}`);
  const snapshot = useSyncExternalStore(subscribeDraft, getAssessmentDraft, getServerDraft);
  const form = useForm<Answers>({ defaultValues: {}, shouldUnregister: false });
  const { reset, watch } = form;
  useEffect(() => {
    if (!active) return;
    const current = initializeDraft(scale);
    reset({ ...current.answers });
    const subscription = watch((answers) => updateDraft(scale, { answers }));
    return () => {
      subscription.unsubscribe();
      // Discard the form's private copy; locale navigation restores the active memory draft.
      reset({});
    };
  }, [active, scale.id, scale.contentVersion, scale.scoringVersion, reset, watch]);
  const current = active && matchesDraft(snapshot, scale) ? snapshot : null;
  return {
    form,
    result: current?.result ?? null,
    errors: current?.errors ?? emptyErrors,
    setResult: (result: AssessmentResult | null) => updateDraft(scale, { result }),
    setErrors: (errors: Record<string, ValidationCode>) => updateDraft(scale, { errors }),
  };
}
