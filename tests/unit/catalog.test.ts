import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { readScale, readScaleIds, readScales } from '../../src/lib/content';
import { scaleSchema } from '../../src/lib/schema';
import { score } from '../../src/lib/scoring';
import { scaleFromPath } from '../../src/i18n/paths';

const reference = readScale('ess');
const psqi = readScale('psqi');
let root: string;
let previous: string | undefined;
function catalog(scales: string[], schemaVersion = 1) {
  fs.writeFileSync(path.join(root, 'scales/index.yaml'), stringify({ schemaVersion, scales }));
}
function definition(id: string) {
  fs.writeFileSync(path.join(root, `scales/${id}.yaml`), stringify({ ...reference, id }));
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ih-catalog-'));
  fs.mkdirSync(path.join(root, 'scales'));
  previous = process.env.IH_CONTENT_DIR;
  process.env.IH_CONTENT_DIR = root;
});
afterEach(() => {
  if (previous === undefined) delete process.env.IH_CONTENT_DIR;
  else process.env.IH_CONTENT_DIR = previous;
  fs.rmSync(root, { recursive: true, force: true });
});
describe('editorial scale catalog', () => {
  it('loads new IDs in the explicitly configured order, ignoring unlisted files', () => {
    definition('second');
    definition('first');
    definition('draft');
    catalog(['second', 'first']);
    expect(readScaleIds()).toEqual(['second', 'first']);
    expect(readScales().map((s) => s.id)).toEqual(['second', 'first']);
    catalog(['first', 'second']);
    expect(readScales().map((s) => s.id)).toEqual(['first', 'second']);
    expect(() => readScale('draft')).toThrow('Unknown scale');
    expect(scaleFromPath('/zh/scales/second/')).toBe('second');
  });
  it('rejects duplicate IDs, paths, empty catalogs and unsupported versions', () => {
    for (const ids of [['ess', 'ess'], ['../ess'], []]) {
      catalog(ids);
      expect(() => readScaleIds()).toThrow();
    }
    catalog(['ess'], 2);
    expect(() => readScaleIds()).toThrow();
  });
  it('fails on missing definitions and mismatched IDs', () => {
    catalog(['missing']);
    expect(() => readScales()).toThrow();
    definition('other');
    fs.renameSync(path.join(root, 'scales/other.yaml'), path.join(root, 'scales/missing.yaml'));
    expect(() => readScales()).toThrow('id must be missing');
  });
  it('accepts a different item count and range without a code change', () => {
    const custom = structuredClone(reference);
    custom.id = 'example';
    custom.itemCount = 1;
    custom.sections = [{ ...custom.sections[0], questions: [custom.sections[0].questions[0]] }];
    custom.range = [0, 3];
    custom.bands = [{ ...custom.bands[0], min: 0, max: 3 }];
    const parsed = scaleSchema.parse(custom);
    expect(score(parsed, { q1: parsed.sections[0].questions[0].options!.at(-1)!.id }).total).toBe(
      3,
    );
    expect(scaleSchema.safeParse({ ...custom, schemaVersion: 2 }).success).toBe(false);
    expect(scaleSchema.safeParse({ ...custom, scoringVersion: '2.0.0' }).success).toBe(false);
  });
  it('applies PSQI validation and scoring by calculator rather than scale ID', () => {
    const custom = scaleSchema.parse({ ...psqi, id: 'psqi-translation' });
    const answers = Object.fromEntries(
      custom.sections
        .flatMap((s) => s.questions)
        .filter((q) => q.type === 'choice')
        .map((q) => [q.id, q.options![0].id]),
    );
    Object.assign(answers, { q1: '23:00', q2: '10', q3: '07:00', q4: '8' });
    expect(score(custom, answers).total).toBe(0);
    expect(() => score(custom, { ...answers, q4: '9' })).toThrow();
  });
});
