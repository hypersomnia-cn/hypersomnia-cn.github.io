import { expect, it } from 'vitest';
import { readScales, readScaleSummaries } from '../../src/lib/content';
it('projects only card data after validating the full content', () => {
  const full = readScales();
  const summary = readScaleSummaries();
  expect(summary).toHaveLength(4);
  summary.forEach((s, i) => {
    expect(Object.keys(s).sort()).toEqual([
      'abbreviation',
      'description',
      'duration',
      'id',
      'itemCount',
      'source',
      'title',
    ]);
    expect(s.source).toEqual(full[i].sources[0]);
    expect(s.title).toEqual(full[i].title);
  });
  expect(Buffer.byteLength(JSON.stringify(summary))).toBeLessThan(
    Buffer.byteLength(JSON.stringify(full)) / 5,
  );
});
