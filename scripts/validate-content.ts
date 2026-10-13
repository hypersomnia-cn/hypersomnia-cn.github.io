import { readScales } from '../src/lib/content';
const scales = readScales();
for (const scale of scales)
  console.log(`${scale.id}: ${scale.sections.flatMap((s) => s.questions).length} fields validated`);
