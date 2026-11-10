import { readdir, readFile } from 'node:fs/promises';
import { pool } from './pool.js';

const dir = new URL('./migrations/', import.meta.url);

const client = await pool.connect();
try {
  await client.query("SELECT set_config('supplyflow.admin_email_1', $1, false)", [
    process.env.ADMIN_EMAIL_1 ?? '',
  ]);
  await client.query("SELECT set_config('supplyflow.admin_email_2', $1, false)", [
    process.env.ADMIN_EMAIL_2 ?? '',
  ]);
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
    await client.query(await readFile(new URL(file, dir), 'utf8'));
    console.log(`applied ${file}`);
  }
} finally {
  client.release();
  await pool.end();
}
