import { readScales } from '../src/lib/content';
import { buildContentIndex } from '../src/lib/markdown';
import { renderDocument } from '../src/lib/markdown-render';
const index = buildContentIndex();
for (const document of index.documents.filter((item) => item.metadata.status === 'published'))
  renderDocument(document);
for (const fragment of index.fragments.values()) renderDocument(fragment, true);
for (const warning of index.warnings) console.warn(warning);
console.log(
  `${index.documents.length} Markdown documents; ${index.pages.length} published pages validated`,
);
const scales = readScales();
for (const scale of scales)
  console.log(`${scale.id}: ${scale.sections.flatMap((s) => s.questions).length} fields validated`);
