import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { scaleSchema, type Scale, type ScaleSummary } from './schema';
import { scaleIds } from './scale-contracts';
import { plainMarkdown } from './markdown-parser';
export { scaleIds } from './scale-contracts';
export function readScale(id: string): Scale {
  if (!(scaleIds as readonly string[]).includes(id)) throw new Error(`Unknown scale: ${id}`);
  const file = path.join(process.cwd(), 'content', 'scales', `${id}.yaml`);
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
  return scaleIds.map(readScale);
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
