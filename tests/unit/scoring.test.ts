import { describe, expect, it } from 'vitest';
import { readScale, readScales } from '../../src/lib/content';
import { score, timeInBed, validateAnswers } from '../../src/lib/scoring';
import { scaleSchema, type Answers, type Scale } from '../../src/lib/schema';
function choices(s: Scale, highest = false): Answers {
  return Object.fromEntries(
    s.sections
      .flatMap((x) => x.questions)
      .filter((q) => q.type === 'choice')
      .map((q) => [q.id, highest ? q.options!.at(-1)!.id : q.options![0].id]),
  );
}
const psqi = readScale('psqi');
function sleep(extra: Answers = {}): Answers {
  return { ...choices(psqi), q1: '23:00', q2: '10', q3: '07:00', q4: '8', ...extra };
}
describe('content and score contracts', () => {
  it('validates all four datasets', () => expect(readScales()).toHaveLength(4));
  for (const id of ['ess', 'ihss', 'fss']) {
    const s = readScale(id);
    it(`${id} minimum and maximum`, () => {
      const low = score(s, choices(s));
      const high = score(s, choices(s, true));
      expect(low.mean ?? low.total).toBe(s.range[0]);
      expect(high.mean ?? high.total).toBe(s.range[1]);
    });
    it(`${id} rejects missing and invalid answers`, () => {
      const a = choices(s);
      delete a.q1;
      expect(() => score(s, a)).toThrow();
      expect(() => score(s, { ...choices(s), q1: 'invalid' })).toThrow();
    });
  }
  for (const id of ['ess', 'ihss']) {
    const s = readScale(id);
    for (const b of s.bands)
      for (const n of [b.min, b.max])
        it(`${id} boundary ${n}`, () => {
          let remaining = n;
          const a: Answers = {};
          for (const q of s.sections.flatMap((x) => x.questions)) {
            const o = q.options!.toReversed().find((o) => o.score <= remaining)!;
            a[q.id] = o.id;
            remaining -= o.score;
          }
          expect(remaining).toBe(0);
          expect(score(s, a).interpretationId).toBe(b.id);
        });
  }
  it('FSS preserves unrounded mean', () => {
    const s = readScale('fss');
    const r = score(s, { ...choices(s), q1: '2' });
    expect(r.total).toBe(10);
    expect(r.mean).toBe(10 / 9);
    expect(r.mean!.toFixed(2)).toBe('1.11');
  });
  it('rejects duplicate IDs, missing translations, bad scores and overlapping bands', () => {
    const source = readScale('ess');
    for (const mutate of [
      (s: Scale) => {
        s.sections[0].questions[1].id = 'q1';
      },
      (s: Scale) => {
        s.title.en = '';
      },
      (s: Scale) => {
        s.sections[0].questions[0].options![0].score = 8;
      },
      (s: Scale) => {
        s.bands[1].min = 5;
      },
    ]) {
      const copy = structuredClone(source);
      mutate(copy);
      expect(scaleSchema.safeParse(copy).success).toBe(false);
    }
  });
});
describe('PSQI independent manual cases', () => {
  it('crosses midnight without absolute-time error', () => {
    expect(timeInBed('23:30', '07:00')).toBe(7.5);
    expect(timeInBed('01:00', '09:00')).toBe(8);
  });
  it('all best responses produce seven zeros', () => {
    const r = score(psqi, sleep());
    expect(r.total).toBe(0);
    expect(Object.values(r.components)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
  it('all worst responses produce 21, partner responses excluded', () => {
    const a = {
      ...choices(psqi, true),
      q1: '22:00',
      q3: '08:00',
      q2: '90',
      q4: '4',
      q5j_text: 'Pain',
    };
    expect(score(psqi, a).total).toBe(21);
  });
  it('matches a hand-calculated mixed case', () => {
    const r = score(
      psqi,
      sleep({
        q1: '23:00',
        q3: '07:00',
        q4: '6',
        q2: '40',
        q5a: '1',
        q5b: '1',
        q6: '1',
        q7: '2',
        q8: '1',
        q9: '2',
      }),
    );
    expect(r.components).toEqual({
      quality: 1,
      latency: 2,
      duration: 1,
      efficiency: 1,
      disturbance: 1,
      medication: 2,
      daytime: 2,
    });
    expect(r.total).toBe(10);
  });
  it.each([
    [15, 0],
    [16, 1],
    [30, 1],
    [31, 1],
    [60, 1],
    [61, 2],
  ])('latency minutes %i => component %i', (minutes, expected) =>
    expect(score(psqi, sleep({ q2: String(minutes) })).components.latency).toBe(expected),
  );
  it.each([
    [7.01, 0],
    [7, 1],
    [6, 1],
    [5.99, 2],
    [5, 2],
    [4.99, 3],
  ])('duration %f => %i', (hours, expected) =>
    expect(score(psqi, sleep({ q4: String(hours) })).components.duration).toBe(expected),
  );
  it.each([
    [8.5, 0],
    [8.49, 1],
    [7.5, 1],
    [7.49, 2],
    [6.5, 2],
    [6.49, 3],
  ])('efficiency boundary with 10h in bed: %f => %i', (hours, expected) =>
    expect(
      score(psqi, sleep({ q1: '22:00', q3: '08:00', q4: String(hours) })).components.efficiency,
    ).toBe(expected),
  );
  it.each([
    [0, 0],
    [1, 1],
    [9, 1],
    [10, 2],
    [18, 2],
    [19, 3],
    [27, 3],
  ])('disturbance sum %i => %i', (n, expected) => {
    let remaining = n;
    const extra: Answers = { q5j_text: 'Other' };
    for (const letter of ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
      const v = Math.min(3, remaining);
      extra[`q5${letter}`] = String(v);
      remaining -= v;
    }
    expect(score(psqi, sleep(extra)).components.disturbance).toBe(expected);
  });
  it('sets 5j to zero if comment or value absent', () => {
    expect(score(psqi, sleep({ q5j: '3' })).components.disturbance).toBe(0);
    expect(score(psqi, sleep({ q5j: undefined, q5j_text: 'Other' })).components.disturbance).toBe(
      0,
    );
  });
  it('accepts unselected optional radios represented as null', () =>
    expect(score(psqi, sleep({ q5j: null, q10: null, q10a: null, q10b: null })).total).toBe(0));
  it('partner observations do not change score', () =>
    expect(score(psqi, sleep({ q10a: '3', q10b: '3' })).total).toBe(0));
  it('rejects impossible and malformed inputs', () => {
    for (const extra of [
      { q3: '23:00' },
      { q4: '9' },
      { q1: '25:00' },
      { q2: '-1' },
      { q4: 'NaN' },
      { q2: '1.5' },
    ])
      expect(Object.keys(validateAnswers(psqi, sleep(extra))).length).toBeGreaterThan(0);
  });
  it('separates reference threshold 5 from 6', () => {
    expect(score(psqi, sleep({ q6: '3', q7: '2' })).interpretationId).toBe('reference');
    expect(score(psqi, sleep({ q6: '3', q7: '3' })).interpretationId).toBe('poor');
  });
});
