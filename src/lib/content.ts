import fs from 'node:fs';
import { z } from 'zod';
import { contentPath } from './content-root';
import { scaleIdPattern } from './scale-id';
import { parse } from 'yaml';
import { scaleSchema, type Scale, type ScaleSummary } from './schema';
import { plainMarkdown } from './markdown-parser';
const catalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    scales: z.array(z.string().regex(scaleIdPattern)).min(1),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    if (new Set(catalog.scales).size !== catalog.scales.length)
      ctx.addIssue({ code: 'custom', path: ['scales'], message: 'Duplicate scale IDs in catalog' });
  });
export function readScaleIds(): string[] {
  const file = contentPath('scales', 'index.yaml');
  try {
    return catalogSchema.parse(parse(fs.readFileSync(file, 'utf8'), { maxAliasCount: 50 })).scales;
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
export function isScaleId(id: string): boolean {
  return readScaleIds().includes(id);
}
export function readScale(id: string): Scale {
  if (!isScaleId(id)) throw new Error(`Unknown scale: ${id}`);
  const file = contentPath('scales', `${id}.yaml`);
  let document: unknown;
  try {
    document = parse(fs.readFileSync(file, 'utf8'), { maxAliasCount: 50 });
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = scaleSchema.safeParse(document);
  if (!result.success)
    throw new Error(
      `${file}\n${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')}`,
    );
  if (result.data.id !== id) throw new Error(`${file}: id must be ${id}`);
  return {
    ...result.data,
    descriptionMarkdown: result.data.description,
    description: {
      zh: plainMarkdown(result.data.description.zh),
      en: plainMarkdown(result.data.description.en),
    },
  };
}
export function readScales() {
  return readScaleIds().map(readScale);
}
export function readScaleSummaries(): ScaleSummary[] {
  return readScales().map(
    ({ id, abbreviation, title, description, duration, itemCount, sources }) => ({
      id,
      abbreviation,
      title,
      description,
      duration,
      itemCount,
      source: sources[0],
    }),
  );
}
