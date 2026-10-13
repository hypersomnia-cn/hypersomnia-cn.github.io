import { z } from 'zod';
import { psqiComponentIds, psqiFields, scaleContracts, scaleIds } from './scale-contracts';
export const localized = z.object({ zh: z.string().trim().min(1), en: z.string().trim().min(1) });
const option = z.object({
  id: z.string().min(1),
  label: localized,
  score: z.number().int().min(0).max(7),
});
const question = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: localized,
    type: z.enum(['choice', 'number', 'time', 'text']),
    required: z.boolean(),
    scored: z.boolean().default(true),
    options: z.array(option).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    help: localized.optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type === 'choice' && (!q.options || q.options.length < 2))
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Choice needs at least two options',
      });
    if (q.type !== 'choice' && q.options)
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Only choice fields can have options',
      });
    if (q.options && new Set(q.options.map((o) => o.id)).size !== q.options.length)
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Duplicate option IDs' });
    if (q.min !== undefined && q.max !== undefined && q.min > q.max)
      ctx.addIssue({ code: 'custom', path: ['min'], message: 'min exceeds max' });
  });
export const scaleSchema = z
  .object({
    id: z.enum(scaleIds),
    abbreviation: z.string().min(1),
    title: localized,
    itemCount: z.number().int().positive(),
    totalRange: z.tuple([z.number(), z.number()]).optional(),
    description: localized,
    instructions: localized,
    recall: localized,
    duration: localized,
    contentVersion: z.string().min(1),
    scoringVersion: z.string().min(1),
    sourceVersion: z.string().min(1),
    calculator: z.enum(['sum', 'mean', 'psqi']),
    range: z.tuple([z.number(), z.number()]),
    scoreLabel: localized,
    disclaimer: localized,
    interpretationNote: localized,
    sources: z.array(z.object({ title: localized, url: z.string().url() })).min(1),
    sections: z
      .array(
        z.object({
          id: z.string().min(1),
          title: localized,
          description: localized.optional(),
          questions: z.array(question).min(1),
        }),
      )
      .min(1),
    bands: z
      .array(
        z.object({
          id: z.string().min(1),
          min: z.number(),
          max: z.number(),
          title: localized,
          explanation: localized,
          advice: localized,
        }),
      )
      .min(1),
    components: z.record(z.string(), localized).optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const contract = scaleContracts[s.id];
    if (s.calculator !== contract.calculator)
      issue(['calculator'], 'Calculator does not match scale');
    if (s.itemCount !== contract.itemCount) issue(['itemCount'], 'Item count does not match scale');
    if (s.range[0] !== contract.range[0] || s.range[1] !== contract.range[1])
      issue(['range'], 'Score range does not match scale');
    if (
      s.id === 'fss' &&
      (s.totalRange?.[0] !== scaleContracts.fss.totalRange[0] ||
        s.totalRange?.[1] !== scaleContracts.fss.totalRange[1])
    )
      issue(['totalRange'], 'FSS requires total range 9–63');
    const ids = new Set<string>();
    s.sections.forEach((section, si) =>
      section.questions.forEach((q, qi) => {
        const at = ['sections', si, 'questions', qi];
        if (ids.has(q.id)) issue([...at, 'id'], `Duplicate question ID ${q.id}`);
        ids.add(q.id);
        if (s.id === 'psqi') {
          const partner = /^q10(?:[a-e]|e_text)?$/.test(q.id);
          const expected =
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
        } else if (q.scored) {
          if (q.type !== 'choice')
            issue([...at, 'type'], 'Sum/mean calculators require choice questions');
          if (!q.required) issue([...at, 'required'], 'Scoring questions must be required');
          if (
            q.options?.some(
              (o) => o.score < contract.optionRange[0] || o.score > contract.optionRange[1],
            )
          )
            issue([...at, 'options'], 'Option score outside scale contract');
        }
      }),
    );
    if (new Set(s.sections.map((x) => x.id)).size !== s.sections.length)
      issue(['sections'], 'Duplicate section IDs');
    if (new Set(s.bands.map((x) => x.id)).size !== s.bands.length)
      issue(['bands'], 'Duplicate band IDs');
    if (s.id === 'psqi') {
      for (const id of Object.keys(psqiFields))
        if (!ids.has(id)) issue(['sections'], `PSQI requires field ${id}`);
      for (const id of psqiComponentIds)
        if (!s.components?.[id]) issue(['components', id], 'Missing component label');
    }
    let possible = new Set<number>();
    if (s.id === 'psqi') {
      possible = new Set(
        Array.from(
          { length: contract.range[1] - contract.range[0] + 1 },
          (_, n) => n + contract.range[0],
        ),
      );
    } else {
      const scored = s.sections.flatMap((x) => x.questions).filter((q) => q.scored);
      if (scored.length !== contract.itemCount)
        issue(['sections'], `${s.id} requires ${contract.itemCount} scored items`);
      let totals = new Set([0]);
      for (const q of scored)
        totals = new Set([...totals].flatMap((sum) => (q.options ?? []).map((o) => sum + o.score)));
      const divisor = contract.calculator === 'mean' ? scored.length : 1;
      possible = new Set([...totals].map((n) => n / divisor));
      if (
        !totals.size ||
        Math.min(...possible) !== s.range[0] ||
        Math.max(...possible) !== s.range[1]
      )
        issue(['range'], 'Declared range differs from possible scores');
      if (
        s.totalRange &&
        (s.totalRange[0] !== Math.min(...totals) || s.totalRange[1] !== Math.max(...totals))
      )
        issue(['totalRange'], 'Declared total range differs from possible scores');
    }
    const sorted = s.bands.toSorted((a, b) => a.min - b.min);
    sorted.forEach((b, i) => {
      if (
        b.min > b.max ||
        b.min < s.range[0] ||
        b.max > s.range[1] ||
        (i > 0 && b.min <= sorted[i - 1].max)
      )
        issue(['bands', s.bands.indexOf(b)], 'Invalid or overlapping range');
    });
    if (!sorted.length) return;
    if (sorted[0].min !== s.range[0] || sorted.at(-1)!.max !== s.range[1])
      issue(['bands'], 'Bands must cover the score endpoints');
    for (const n of possible) {
      if (s.bands.filter((b) => n >= b.min && n <= b.max).length !== 1) {
        issue(['bands'], `Reachable score ${n} must have exactly one interpretation`);
        break;
      }
    }
  });
export type Scale = z.infer<typeof scaleSchema>;
export type Question = Scale['sections'][number]['questions'][number];
export type Language = 'zh' | 'en';
export type Answers = Record<string, string | number | null | undefined>;
export type AssessmentResult = {
  scaleId: Scale['id'];
  contentVersion: string;
  scoringVersion: string;
  total: number;
  mean?: number;
  components: Record<string, number>;
  interpretationId: string;
};
export type ScaleSummary = Pick<
  Scale,
  'id' | 'abbreviation' | 'title' | 'description' | 'duration' | 'itemCount'
> & { source: Scale['sources'][number] };
