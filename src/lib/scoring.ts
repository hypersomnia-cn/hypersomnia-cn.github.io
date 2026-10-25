import type { Answers, AssessmentResult, Scale } from './schema';
export type ValidationCode = 'invalid' | 'sameTime' | 'sleepTooLong';
export function validateAnswers(scale: Scale, answers: Answers): Record<string, ValidationCode> {
  const errors: Record<string, ValidationCode> = {};
  const message = 'invalid';
  for (const q of scale.sections.flatMap((s) => s.questions)) {
    const raw = answers[q.id];
    if (raw == null || raw === '' || (typeof raw === 'string' && !raw.trim())) {
      if (q.required) errors[q.id] = message;
      continue;
    }
    if (q.type === 'choice' && !q.options?.some((o) => o.id === String(raw)))
      errors[q.id] = message;
    if (q.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw))) errors[q.id] = message;
    if (q.type === 'number') {
      const n = Number(raw);
      if (
        !Number.isFinite(n) ||
        (q.min !== undefined && n < q.min) ||
        (q.max !== undefined && n > q.max) ||
        (q.step === 1 && !Number.isInteger(n))
      )
        errors[q.id] = message;
    }
  }
  if (scale.calculator === 'psqi' && !errors.q1 && !errors.q3 && answers.q1 && answers.q3) {
    const hours = timeInBed(String(answers.q1), String(answers.q3));
    if (hours === 0) errors.q3 = 'sameTime';
    else if (!errors.q4 && Number(answers.q4) > hours) errors.q4 = 'sleepTooLong';
  }
  return errors;
}
export function timeInBed(bed: string, rise: string): number {
  const minutes = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  return ((minutes(rise) - minutes(bed) + 1440) % 1440) / 60;
}
export function score(scale: Scale, answers: Answers): AssessmentResult {
  const errors = validateAnswers(scale, answers);
  if (Object.keys(errors).length)
    throw new Error(`Invalid answers: ${Object.keys(errors).join(', ')}`);
  const questions = scale.sections.flatMap((s) => s.questions);
  const value = (id: string) => {
    const q = questions.find((q) => q.id === id);
    if (!q || q.type !== 'choice') throw new Error(`Invalid choice contract: ${id}`);
    const raw = answers[id];
    if (
      scale.calculator === 'psqi' &&
      id === 'q5j' &&
      (raw == null || (typeof raw === 'string' && !raw.trim()))
    )
      return 0;
    const option = q.options?.find((o) => o.id === String(raw));
    if (!option) throw new Error(`Invalid choice answer: ${id}`);
    return option.score;
  };
  let total = 0;
  let mean: number | undefined;
  let components: Record<string, number> = {};
  if (scale.calculator === 'psqi') {
    const combine = (n: number) => (n === 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : 3);
    const minutes = Number(answers.q2);
    const latency = minutes <= 15 ? 0 : minutes <= 30 ? 1 : minutes <= 60 ? 2 : 3;
    const hours = Number(answers.q4);
    const efficiency = (hours / timeInBed(String(answers.q1), String(answers.q3))) * 100;
    const other = String(answers.q5j_text ?? '').trim() ? value('q5j') : 0;
    const disturbance = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].reduce(
      (sum, x) => sum + value(`q5${x}`),
      other,
    );
    components = {
      quality: value('q6'),
      latency: combine(latency + value('q5a')),
      duration: hours > 7 ? 0 : hours >= 6 ? 1 : hours >= 5 ? 2 : 3,
      efficiency: efficiency >= 85 ? 0 : efficiency >= 75 ? 1 : efficiency >= 65 ? 2 : 3,
      disturbance: disturbance === 0 ? 0 : disturbance <= 9 ? 1 : disturbance <= 18 ? 2 : 3,
      medication: value('q7'),
      daytime: combine(value('q8') + value('q9')),
    };
    total = Object.values(components).reduce((a, b) => a + b, 0);
  } else {
    const scored = questions.filter((q) => q.scored);
    total = scored.reduce((sum, q) => sum + value(q.id), 0);
    if (scale.calculator === 'mean') mean = total / scored.length;
  }
  const displayed = mean ?? total;
  const band = scale.bands.find((b) => displayed >= b.min && displayed <= b.max);
  if (!band) throw new Error('Score has no interpretation band');
  return {
    scaleId: scale.id,
    contentVersion: scale.contentVersion,
    scoringVersion: scale.scoringVersion,
    total,
    mean,
    components,
    interpretationId: band.id,
  };
}
