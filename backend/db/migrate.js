import { readdir, readFile } from 'node:fs/promises';
import { pool } from './pool.js';

const dir = new URL('./migrations/', import.meta.url);

try {
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
    await pool.query(await readFile(new URL(file, dir), 'utf8'));
    console.log(`applied ${file}`);
  }
} finally {
  await pool.end();
}
