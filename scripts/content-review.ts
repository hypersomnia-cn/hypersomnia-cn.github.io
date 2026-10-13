import fs from 'node:fs';
import { readScales } from '../src/lib/content';
const escape = (s: string) => s.replaceAll('|', '\\|').replaceAll('\n', ' ');
let text =
  '# 中英内容校对表\n\n由 YAML 自动生成。请修改 content/scales/*.yaml 后重新运行 pnpm review:content，不要只修改此文档。\n\n';
for (const s of readScales()) {
  text += `## ${s.abbreviation}\n\n来源版本：${s.sourceVersion}；内容 ${s.contentVersion}；计分 ${s.scoringVersion}。\n\n${s.sources.map((x) => `- [${x.title.zh}](${x.url})`).join('\n')}\n\n| ID | 中文 | English | 分值 |\n| --- | --- | --- | --- |\n`;
  for (const section of s.sections)
    for (const q of section.questions) {
      text += `| ${q.id} | ${escape(q.label.zh)} | ${escape(q.label.en)} | ${q.scored ? '计分' : '不计分'} |\n`;
      for (const o of q.options ?? [])
        text += `| ${q.id}.${o.id} | ${escape(o.label.zh)} | ${escape(o.label.en)} | ${o.score} |\n`;
    }
  text += '\n';
  for (const b of s.bands)
    text += `### ${b.id} (${b.min}–${b.max})\n\n${b.title.zh} / ${b.title.en}\n\n${b.explanation.zh}\n\n${b.explanation.en}\n\n建议：${b.advice.zh}\n\n${b.advice.en}\n\n`;
}
fs.mkdirSync('.local/development', { recursive: true });
fs.writeFileSync('.local/development/content-review.md', text);
