import path from 'node:path';

export function contentRoot() {
  return path.resolve(process.env.IH_CONTENT_DIR || path.join(process.cwd(), '..', 'content'));
}

export function contentPath(...parts: string[]) {
  return path.join(contentRoot(), ...parts);
}
