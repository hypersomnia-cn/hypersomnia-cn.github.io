import fs from 'node:fs';
import path from 'node:path';
import { locales } from '../src/i18n/messages';
import { contentKinds } from '../src/lib/markdown-schema';

// Next.js requires a generated parameter even for an empty static collection.
// Its notFound() output is a 404 document served as 200 by file-only hosts.
// Remove only the reserved build placeholder so the host returns a real 404.
const output = path.resolve('out');
for (const locale of locales) {
  for (const kind of contentKinds) {
    const placeholder = path.resolve(output, locale, kind, '__empty__');
    if (!placeholder.startsWith(`${output}${path.sep}`)) throw new Error('Invalid export path');
    fs.rmSync(placeholder, { recursive: true, force: true });
  }
}
