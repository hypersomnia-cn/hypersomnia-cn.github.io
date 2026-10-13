import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { scaleSchema, type Scale } from './schema';
export const scaleIds = ['ihss', 'ess', 'fss', 'psqi'] as const;
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
  return result.data;
}
export function readScales() {
  return scaleIds.map(readScale);
}
