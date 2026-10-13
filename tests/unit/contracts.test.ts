import { describe, expect, it } from 'vitest';
import { readScale } from '../../src/lib/content';
import { scaleSchema, type Scale } from '../../src/lib/schema';
import { score, validateAnswers } from '../../src/lib/scoring';

const field = (s: Scale, id: string) =>
  s.sections.flatMap((x) => x.questions).find((q) => q.id === id)!;

describe('fixed content contracts', () => {
  for (const id of [
    'q5a',
    'q5b',
    'q5c',
    'q5d',
    'q5e',
    'q5f',
    'q5g',
    'q5h',
    'q5i',
    'q6',
    'q7',
    'q8',
    'q9',
  ]) {
    for (const property of ['type', 'required', 'scored'] as const) {
      it(`rejects PSQI ${id} changed ${property}`, () => {
        const s = readScale('psqi');
        const q = field(s, id);
        if (property === 'type') {
          q.type = 'text';
          delete q.options;
        } else q[property] = false;
        const parsed = scaleSchema.safeParse(s);
        expect(parsed.success).toBe(false);
        if (!parsed.success)
          expect(parsed.error.issues.some((x) => x.path.at(-1) === property)).toBe(true);
      });
    }
  }
  it('checks PSQI numeric boundaries, optional fields and score range', () => {
    const mutations: Array<(s: Scale) => void> = [
      (s) => {
        delete field(s, 'q2').min;
      },
      (s) => {
        field(s, 'q2').max = 1441;
      },
      (s) => {
        field(s, 'q2').step = 0.5;
      },
      (s) => {
        field(s, 'q4').min = -1;
      },
      (s) => {
        field(s, 'q4').max = 25;
      },
      (s) => {
        field(s, 'q4').step = 1;
      },
      (s) => {
        field(s, 'q1').required = false;
      },
      (s) => {
        field(s, 'q3').scored = false;
      },
      (s) => {
        field(s, 'q5j').required = true;
      },
      (s) => {
        field(s, 'q5j_text').type = 'number';
      },
      (s) => {
        field(s, 'q10a').scored = true;
      },
      (s) => {
        field(s, 'q5b').options![0].score = 1;
      },
      (s) => {
        s.range[1] = 20;
        s.bands.at(-1)!.max = 20;
      },
    ];
    for (const mutate of mutations) {
      const s = readScale('psqi');
      mutate(s);
      expect(scaleSchema.safeParse(s).success).toBe(false);
    }
  });
  it('requires the FSS total range', () => {
    const s = readScale('fss');
    delete s.totalRange;
    expect(scaleSchema.safeParse(s).success).toBe(false);
    s.totalRange = [9, 62];
    expect(scaleSchema.safeParse(s).success).toBe(false);
  });
  it('rejects mean bands that miss reachable scores', () => {
    const s = readScale('fss');
    s.bands = [
      { ...s.bands[0], id: 'low', min: 1, max: 3 },
      { ...s.bands[0], id: 'high', min: 4, max: 7 },
    ];
    expect(scaleSchema.safeParse(s).success).toBe(false);
  });
  it('allows a gap that contains no reachable mean', () => {
    const s = readScale('fss');
    s.bands = [
      { ...s.bands[0], id: 'low', min: 1, max: 3 },
      { ...s.bands[0], id: 'high', min: 3.01, max: 7 },
    ];
    expect(scaleSchema.safeParse(s).success).toBe(true);
  });
  it('reports empty bands as a validation error without throwing', () => {
    for (const id of ['ess', 'psqi']) {
      const s = readScale(id);
      s.bands = [];
      expect(() => scaleSchema.safeParse(s)).not.toThrow();
      const parsed = scaleSchema.safeParse(s);
      expect(parsed.success).toBe(false);
      if (!parsed.success)
        expect(parsed.error.issues.some((x) => x.path[0] === 'bands')).toBe(true);
    }
  });
});

describe('scoring safety and compatibility', () => {
  it('gives a unique interpretation for all 55 FSS means without rounding', () => {
    const s = readScale('fss');
    for (let total = 9; total <= 63; total++) {
      let remaining = total - 9;
      const answers = Object.fromEntries(
        s.sections
          .flatMap((x) => x.questions)
          .map((q) => {
            const extra = Math.min(6, remaining);
            remaining -= extra;
            return [q.id, String(1 + extra)];
          }),
      );
      const result = score(s, answers);
      expect(result.total).toBe(total);
      expect(result.mean).toBe(total / 9);
      expect(s.bands.filter((b) => result.mean! >= b.min && result.mean! <= b.max)).toHaveLength(1);
    }
  });
  it('never silently scores a missing required choice as zero', () => {
    const s = readScale('ess');
    field(s, 'q1').required = false;
    const answers = Object.fromEntries(
      s.sections
        .flatMap((x) => x.questions)
        .slice(1)
        .map((q) => [q.id, q.options![0].id]),
    );
    expect(() => score(s, answers)).toThrow();
  });
  it('keeps the existing acceptance of fractional sleep hours', () => {
    const s = readScale('psqi');
    const answers = Object.fromEntries(
      s.sections
        .flatMap((x) => x.questions)
        .filter((q) => q.type === 'choice')
        .map((q) => [q.id, q.options![0].id]),
    );
    Object.assign(answers, { q1: '23:00', q2: '10', q3: '07:00', q4: '7.001' });
    expect(validateAnswers(s, answers)).toEqual({});
  });
});
