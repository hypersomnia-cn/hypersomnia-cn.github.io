import { z } from 'zod';
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
    if (q.options && new Set(q.options.map((o) => o.id)).size !== q.options.length)
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Duplicate option IDs' });
    if (q.min !== undefined && q.max !== undefined && q.min > q.max)
      ctx.addIssue({ code: 'custom', path: ['min'], message: 'min exceeds max' });
  });
export const scaleSchema = z
  .object({
    id: z.enum(['ess', 'ihss', 'fss', 'psqi']),
    abbreviation: z.string(),
    title: localized,
    itemCount: z.number().int().positive(),
    totalRange: z.tuple([z.number(), z.number()]).optional(),
    description: localized,
    instructions: localized,
    recall: localized,
    duration: localized,
    contentVersion: z.string(),
    scoringVersion: z.string(),
    sourceVersion: z.string(),
    calculator: z.enum(['sum', 'mean', 'psqi']),
    range: z.tuple([z.number(), z.number()]),
    scoreLabel: localized,
    disclaimer: localized,
    interpretationNote: localized,
    sources: z.array(z.object({ title: localized, url: z.string().url() })).min(1),
    sections: z
      .array(
        z.object({
          id: z.string(),
          title: localized,
          description: localized.optional(),
          questions: z.array(question).min(1),
        }),
      )
      .min(1),
    bands: z
      .array(
        z.object({
          id: z.string(),
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
    const ids = new Set<string>();
    s.sections.forEach((section, si) =>
      section.questions.forEach((q, qi) => {
        if (ids.has(q.id))
          ctx.addIssue({
            code: 'custom',
            path: ['sections', si, 'questions', qi, 'id'],
            message: `Duplicate question ID ${q.id}`,
          });
        ids.add(q.id);
        if (s.calculator !== 'psqi' && q.scored && q.type !== 'choice')
          ctx.addIssue({
            code: 'custom',
            path: ['sections', si, 'questions', qi],
            message: 'Sum/mean calculators require choice questions',
          });
        if (
          q.scored &&
          s.calculator !== 'psqi' &&
          (!q.required ||
            q.options?.some(
              (o) =>
                o.score > (s.id === 'ess' ? 3 : s.id === 'ihss' ? 4 : 7) ||
                (s.id === 'fss' && o.score < 1),
            ))
        )
          ctx.addIssue({
            code: 'custom',
            path: ['sections', si, 'questions', qi, 'options'],
            message: 'Invalid score or optional scoring question',
          });
      }),
    );
    if (new Set(s.sections.map((x) => x.id)).size !== s.sections.length)
      ctx.addIssue({ code: 'custom', path: ['sections'], message: 'Duplicate section IDs' });
    if (new Set(s.bands.map((x) => x.id)).size !== s.bands.length)
      ctx.addIssue({ code: 'custom', path: ['bands'], message: 'Duplicate band IDs' });
    const sorted = s.bands.toSorted((a, b) => a.min - b.min);
    sorted.forEach((b, i) => {
      if (
        b.min > b.max ||
        b.min < s.range[0] ||
        b.max > s.range[1] ||
        (i > 0 && b.min <= sorted[i - 1].max)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['bands', s.bands.indexOf(b)],
          message: 'Invalid or overlapping range',
        });
    });
    if (sorted[0].min !== s.range[0] || sorted.at(-1)!.max !== s.range[1])
      ctx.addIssue({
        code: 'custom',
        path: ['bands'],
        message: 'Bands must cover the score endpoints',
      });
    if (s.calculator !== 'mean' && sorted.some((b, i) => i > 0 && b.min !== sorted[i - 1].max + 1))
      ctx.addIssue({ code: 'custom', path: ['bands'], message: 'Gap between integer score bands' });
    if (s.id === 'psqi') {
      const required = [
        'q1',
        'q2',
        'q3',
        'q4',
        'q5a',
        'q5b',
        'q5c',
        'q5d',
        'q5e',
        'q5f',
        'q5g',
        'q5h',
        'q5i',
        'q5j',
        'q5j_text',
        'q6',
        'q7',
        'q8',
        'q9',
      ];
      for (const id of required)
        if (!ids.has(id))
          ctx.addIssue({
            code: 'custom',
            path: ['sections'],
            message: `PSQI requires field ${id}`,
          });
      for (const id of [
        'quality',
        'latency',
        'duration',
        'efficiency',
        'disturbance',
        'medication',
        'daytime',
      ])
        if (!s.components?.[id])
          ctx.addIssue({
            code: 'custom',
            path: ['components', id],
            message: 'Missing component label',
          });
      s.sections.forEach((section, si) =>
        section.questions.forEach((q, qi) => {
          if (
            (q.id.startsWith('q5') && q.type === 'choice') ||
            ['q6', 'q7', 'q8', 'q9'].includes(q.id)
          ) {
            if (
              q.type !== 'choice' ||
              q.options
                ?.map((o) => o.score)
                .sort((a, b) => a - b)
                .join(',') !== '0,1,2,3'
            )
              ctx.addIssue({
                code: 'custom',
                path: ['sections', si, 'questions', qi, 'options'],
                message: 'PSQI scoring choices must have scores 0,1,2,3',
              });
          }
          if (
            (['q1', 'q3'].includes(q.id) && q.type !== 'time') ||
            (['q2', 'q4'].includes(q.id) && q.type !== 'number')
          )
            ctx.addIssue({
              code: 'custom',
              path: ['sections', si, 'questions', qi, 'type'],
              message: 'PSQI field type does not match calculator',
            });
          if (!['q5j', 'q5j_text'].includes(q.id) && q.scored && !q.required)
            ctx.addIssue({
              code: 'custom',
              path: ['sections', si, 'questions', qi, 'required'],
              message: 'PSQI scored field must be required',
            });
          if (q.id.startsWith('q10') && q.scored)
            ctx.addIssue({
              code: 'custom',
              path: ['sections', si, 'questions', qi, 'scored'],
              message: 'Partner observations cannot be scored',
            });
        }),
      );
    } else {
      const expected = s.id === 'ess' ? 8 : s.id === 'ihss' ? 14 : 9;
      const scored = s.sections.flatMap((x) => x.questions).filter((q) => q.scored);
      if (scored.length !== expected)
        ctx.addIssue({
          code: 'custom',
          path: ['sections'],
          message: `${s.id} requires ${expected} scored items`,
        });
      const min = scored.reduce(
        (sum, q) => sum + Math.min(...(q.options ?? []).map((o) => o.score)),
        0,
      );
      const max = scored.reduce(
        (sum, q) => sum + Math.max(...(q.options ?? []).map((o) => o.score)),
        0,
      );
      const divisor = s.calculator === 'mean' ? scored.length : 1;
      if (min / divisor !== s.range[0] || max / divisor !== s.range[1])
        ctx.addIssue({
          code: 'custom',
          path: ['range'],
          message: 'Declared range differs from possible scores',
        });
    }
    if (
      (s.id === 'psqi' && s.calculator !== 'psqi') ||
      (s.id === 'fss' && s.calculator !== 'mean') ||
      (['ess', 'ihss'].includes(s.id) && s.calculator !== 'sum')
    )
      ctx.addIssue({
        code: 'custom',
        path: ['calculator'],
        message: 'Calculator does not match scale',
      });
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
