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

async function main() {
  await client.connect();

  // Find users linked to workers in unit 5
  const { rows } = await client.query(`
    SELECT u.id, u.email, u.full_name, u.organization_id, u.is_active,
           w.id as worker_id, w.worker_code,
           um.unit_id, um.role_code
    FROM maywin_db.users u
    JOIN maywin_db.workers w ON w.linked_user_id = u.id
    JOIN maywin_db.unit_memberships um ON um.user_id = u.id
    WHERE w.primary_unit_id = 5
    ORDER BY w.worker_code
    LIMIT 20
  `);
  console.log('=== Existing nurse users linked to unit 5 workers ===');
  console.table(rows);

  // Also check worker 176 link status
  const { rows: w176 } = await client.query(`
    SELECT id, full_name, worker_code, linked_user_id, primary_unit_id, organization_id
    FROM maywin_db.workers WHERE id = 176
  `);
  console.log('\n=== Worker 176 ===');
  console.table(w176);

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
