export const scaleIds = ['ihss', 'ess', 'fss', 'psqi'] as const;
export type ScaleId = (typeof scaleIds)[number];
export const scaleContracts = {
  ihss: { calculator: 'sum', itemCount: 14, range: [0, 50], optionRange: [0, 4] },
  ess: { calculator: 'sum', itemCount: 8, range: [0, 24], optionRange: [0, 3] },
  fss: {
    calculator: 'mean',
    itemCount: 9,
    range: [1, 7],
    optionRange: [1, 7],
    totalRange: [9, 63],
  },
  psqi: { calculator: 'psqi', itemCount: 19, range: [0, 21], optionRange: [0, 3] },
} as const;
type FieldContract = {
  type: 'choice' | 'number' | 'time' | 'text';
  required: boolean;
  scored: boolean;
  min?: number;
  max?: number;
  step?: number;
};
const choice: FieldContract = { type: 'choice', required: true, scored: true };
export const psqiFields: Readonly<Record<string, FieldContract>> = {
  q1: { type: 'time', required: true, scored: true },
  q2: { type: 'number', required: true, scored: true, min: 0, max: 1440, step: 1 },
  q3: { type: 'time', required: true, scored: true },
  q4: { type: 'number', required: true, scored: true, min: 0, max: 24, step: 0.01 },
  ...Object.fromEntries(
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((x) => [`q5${x}`, choice]),
  ),
  q5j: { ...choice, required: false },
  q5j_text: { type: 'text', required: false, scored: false },
  q6: choice,
  q7: choice,
  q8: choice,
  q9: choice,
};
export const psqiComponentIds = [
  'quality',
  'latency',
  'duration',
  'efficiency',
  'disturbance',
  'medication',
  'daytime',
] as const;
export function isScaleId(value: string): value is ScaleId {
  return (scaleIds as readonly string[]).includes(value);
}
