import { z } from 'zod';

export const contentKinds = ['wiki', 'blog'] as const;
export type ContentKind = (typeof contentKinds)[number];
const name = z.string().trim().min(1);
const identifier = name.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const date = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Expected a real calendar date (YYYY-MM-DD)');

export const contentMetadataSchema = z
  .strictObject({
    id: identifier,
    slug: identifier.optional(),
    title: name,
    language: z.enum(['zh-CN', 'en']),
    description: name.optional(),
    status: z.enum(['draft', 'published']).default('draft'),
    updated: date.optional(),
    published: date.optional(),
    authors: z.array(name).default([]),
    tags: z.array(name).default([]),
    aliases: z.array(name).default([]),
    english_title: name.optional(),
    abbreviation: name.optional(),
    primary_reference: z
      .string()
      .url()
      .refine((url) => /^https?:\/\//.test(url), 'Expected HTTP(S) URL')
      .optional(),
  })
  .superRefine((value, ctx) => {
    for (const key of ['description', 'updated'] as const) {
      if (value.status === 'published' && !value[key])
        ctx.addIssue({ code: 'custom', path: [key], message: 'Required for published content' });
    }
    if (value.updated && value.published && value.updated < value.published)
      ctx.addIssue({ code: 'custom', path: ['updated'], message: 'updated precedes published' });
  })
  .transform((value) => ({ ...value, slug: value.slug ?? value.id }));

export type ContentMetadata = z.infer<typeof contentMetadataSchema>;
