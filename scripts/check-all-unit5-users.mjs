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

  // All users in unit 5 via memberships
  const { rows } = await client.query(`
    SELECT u.id as user_id, u.email, u.full_name, u.organization_id,
           um.role_code, um.unit_id,
           w.id as worker_id, w.worker_code
    FROM maywin_db.unit_memberships um
    JOIN maywin_db.users u ON u.id = um.user_id
    LEFT JOIN maywin_db.workers w ON w.linked_user_id = u.id
    WHERE um.unit_id = 5
    ORDER BY w.worker_code NULLS LAST, u.id
  `);
  console.log('=== All users in unit 5 ===');
  console.table(rows);

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
