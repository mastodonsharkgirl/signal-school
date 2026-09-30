import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const hashes = new Set();
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (file.endsWith('.html')) {
      const html = await readFile(file, 'utf8');
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (!/\bsrc\s*=/i.test(match[1]) && match[2].trim())
          hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
      }
    }
  }
}
await scan('dist');
const template = await readFile('public/_headers', 'utf8');
if (!template.includes("script-src 'self';")) throw new Error('Expected strict script policy');
await writeFile(
  'dist/_headers',
  template.replace("script-src 'self';", `script-src 'self' ${[...hashes].sort().join(' ')};`),
);
console.log(
  `Allowed ${hashes.size} exact built inline scripts; arbitrary inline scripts remain blocked.`,
);
