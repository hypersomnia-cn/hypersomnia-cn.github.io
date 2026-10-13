import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
function keys(value: object, prefix = ''): string[] {
  return Object.entries(value)
    .flatMap(([key, v]) => {
      const name = prefix ? `${prefix}.${key}` : key;
      if (typeof v === 'string') {
        if (!v.trim()) throw new Error(`Empty locale message: ${name}`);
        return [name];
      }
      return keys(v, name);
    })
    .sort();
}
if (JSON.stringify(keys(zh)) !== JSON.stringify(keys(en)))
  throw new Error('Locale message keys must match');
function inspect(dir: string, recursive = true) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) inspect(file);
    } else if (/\.(ts|tsx|mjs|js|css)$/.test(file)) {
      const source = fs.readFileSync(file, 'utf8');
      if (file.endsWith('.css')) {
        for (const match of source.matchAll(/\/\*[\s\S]*?\*\//g))
          if (/\p{Script=Han}/u.test(match[0]))
            throw new Error(`${file}: Chinese characters in comments`);
      } else {
        const syntax = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
        for (const comment of syntax.comments ?? [])
          if (/\p{Script=Han}/u.test(comment.value))
            throw new Error(`${file}:${comment.loc?.start.line}: Chinese characters in comments`);
      }
    }
  }
}
inspect('src');
inspect('scripts');
inspect('tests');
inspect('.', false);
console.log('Locale messages and English-only code comments validated');
