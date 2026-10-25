type FieldContract = {
  type: 'choice' | 'number' | 'time' | 'text';
  required: boolean;
  scored: boolean;
  min?: number;
  max?: number;
  step?: number;
};
const choice: FieldContract = { type: 'choice', required: true, scored: true };
export const psqiFields: Readonly<Record<string, FieldContract>> = {
  q1: { type: 'time', required: true, scored: true },
  q2: { type: 'number', required: true, scored: true, min: 0, max: 1440, step: 1 },
  q3: { type: 'time', required: true, scored: true },
  q4: { type: 'number', required: true, scored: true, min: 0, max: 24, step: 0.01 },
  ...Object.fromEntries(
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((x) => [`q5${x}`, choice]),
  ),
  q5j: { ...choice, required: false },
  q5j_text: { type: 'text', required: false, scored: false },
  q6: choice,
  q7: choice,
  q8: choice,
  q9: choice,
};
export const psqiComponentIds = [
  'quality',
  'latency',
  'duration',
  'efficiency',
  'disturbance',
  'medication',
  'daytime',
] as const;

type PsqiDefinition = {
  itemCount: number;
  range: [number, number];
  sections: { questions: (FieldContract & { id: string; options?: { score: number }[] })[] }[];
  components?: Record<string, unknown>;
};
export function validatePsqiDefinition(
  scale: PsqiDefinition,
  issue: (path: (string | number)[], message: string) => void,
) {
  if (scale.itemCount !== 19) issue(['itemCount'], 'PSQI requires 19 items');
  if (scale.range[0] !== 0 || scale.range[1] !== 21)
    issue(['range'], 'PSQI requires score range 0–21');
  const ids = new Set<string>();
  scale.sections.forEach((section, si) =>
    section.questions.forEach((q, qi) => {
      ids.add(q.id);
      const at = ['sections', si, 'questions', qi];
      const partner = /^q10(?:[a-e]|e_text)?$/.test(q.id);
      const expected: FieldContract | undefined =
        psqiFields[q.id] ??
        (partner
          ? { type: q.id === 'q10e_text' ? 'text' : 'choice', required: false, scored: false }
          : undefined);
      if (!expected) issue([...at, 'id'], 'Unknown PSQI field');
      else {
        for (const [key, value] of Object.entries(expected)) {
          if (q[key as keyof typeof q] !== value)
            issue([...at, key], `PSQI ${q.id} requires ${key}=${value}`);
        }
        if (
          expected.type === 'choice' &&
          q.options
            ?.map((o) => o.score)
            .toSorted((a, b) => a - b)
            .join(',') !== '0,1,2,3'
        )
          issue([...at, 'options'], 'PSQI choices must have scores 0,1,2,3');
      }
    }),
  );
  for (const id of Object.keys(psqiFields))
    if (!ids.has(id)) issue(['sections'], `PSQI requires field ${id}`);
  for (const id of psqiComponentIds)
    if (!scale.components?.[id]) issue(['components', id], 'Missing component label');
}
