import pg from '../node_modules/pg/lib/index.js';
const { Client } = pg;

const client = new Client({
  host: 'maywin-restored.cf4o8yiqanwf.ap-southeast-1.rds.amazonaws.com',
  port: 5432,
  database: 'maywin',
  user: 'postgres',
  password: 'maywin12345',
  ssl: { rejectUnauthorized: false },
});

const RECODE_MAP = [
  { id: 69, code: 'NURSE_001' },
  { id: 70, code: 'NURSE_002' },
  { id: 71, code: 'NURSE_003' },
  { id: 72, code: 'NURSE_004' },
  { id: 73, code: 'NURSE_005' },
  { id: 74, code: 'NURSE_006' },
  { id: 75, code: 'NURSE_007' },
  { id: 76, code: 'NURSE_008' },
  { id: 176, code: 'NURSE_009' },
];

async function main() {
  await client.connect();
  console.log('Connected.\n');

  // 1. Show current state
  const { rows: before } = await client.query(
    `SELECT id, full_name, worker_code, primary_unit_id, is_active
     FROM maywin_db.workers WHERE id = ANY($1) ORDER BY id`,
    [RECODE_MAP.map(r => r.id)]
  );
  console.log('=== BEFORE ===');
  console.table(before);

  // 2. Apply worker_code updates
  for (const { id, code } of RECODE_MAP) {
    const res = await client.query(
      `UPDATE maywin_db.workers SET worker_code = $1 WHERE id = $2`,
      [code, id]
    );
    console.log(`  id=${id} → ${code}  (rows affected: ${res.rowCount})`);
  }

  // 3. Show result
  const { rows: after } = await client.query(
    `SELECT id, full_name, worker_code, primary_unit_id, is_active
     FROM maywin_db.workers WHERE id = ANY($1) ORDER BY id`,
    [RECODE_MAP.map(r => r.id)]
  );
  console.log('\n=== AFTER ===');
  console.table(after);

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
