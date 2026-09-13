import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const skip = new Set(['.git', '.tools', 'node_modules']);
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (/\.(js|mjs|cjs)$/.test(entry)) {
      files.push(full);
    }
  }
}

walk(root);

let failed = false;
for (const file of files) {
  const rel = relative(root, file);
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    console.error(`Syntax check failed: ${rel}`);
    process.stderr.write(result.stderr || result.stdout || '');
  }
}

if (failed) process.exit(1);
console.log(`JavaScript syntax check passed (${files.length} files).`);
