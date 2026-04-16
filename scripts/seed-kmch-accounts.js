/**
 * seed-kmch-accounts.js
 *
 * One-time migration: creates web login accounts for all workers in a given
 * organisation that don't yet have one, then links them via linked_user_id.
 *
 * Usage:
 *   node scripts/seed-kmch-accounts.js
 *
 * Prerequisites:
 *   npm install pg bcrypt   (or npx --yes in the command below)
 *
 * The script will:
 *   1. List every worker in the target org that has linked_user_id IS NULL
 *   2. For each worker, INSERT a row into `users` (hashed password)
 *   3. INSERT a row into `unit_memberships` for their primary unit
 *   4. UPDATE workers SET linked_user_id = <new user id>
 *   5. Print a summary table you can hand to the nurses
 *
 * EDIT THE CONFIG BLOCK BELOW BEFORE RUNNING.
 */

'use strict';

const { Client } = require('pg');
const bcrypt = require('bcrypt');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const DB = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT || 5432),
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'maywin_db',
};

// The organisation code or name to seed (used to find the org row)
const TARGET_ORG_CODE = process.env.ORG_CODE || 'KMCH';

// Default password given to every new account.
// Nurses should change this on first login.
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'MayWin2025!';

// Role to assign to all seeded accounts
const DEFAULT_ROLE = 'NURSE';

// ─────────────────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 10;

async function main() {
  const client = new Client(DB);
  await client.connect();
  console.log(`Connected to ${DB.host}:${DB.port}/${DB.database}\n`);

  try {
    // 1 — Find the target organisation
    const orgRes = await client.query(
      `SELECT id, name FROM organizations WHERE code = $1 LIMIT 1`,
      [TARGET_ORG_CODE]
    );
    if (orgRes.rows.length === 0) {
      throw new Error(`Organisation with code "${TARGET_ORG_CODE}" not found.`);
    }
    const org = orgRes.rows[0];
    console.log(`Organisation: ${org.name} (id=${org.id})\n`);

    // 2 — Find all unlinked workers in this org
    const workerRes = await client.query(
      `SELECT id, full_name, worker_code, primary_unit_id
       FROM workers
       WHERE organization_id = $1
         AND linked_user_id IS NULL
         AND is_active = true
       ORDER BY full_name`,
      [String(org.id)]
    );

    if (workerRes.rows.length === 0) {
      console.log('No unlinked workers found. Nothing to do.');
      return;
    }

    console.log(`Found ${workerRes.rows.length} unlinked worker(s):\n`);
    workerRes.rows.forEach(w => console.log(`  ${w.worker_code}  ${w.full_name}`));
    console.log('');

    const hashedPw = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    const results = [];

    for (const worker of workerRes.rows) {
      // Derive a login email from worker_code  e.g.  N001 → n001@kmch.local
      const email = `${worker.worker_code.toLowerCase()}@${TARGET_ORG_CODE.toLowerCase()}.local`;

      // 3 — Insert user row
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name, organization_id, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [email, hashedPw, worker.full_name, String(org.id)]
      );

      let userId;
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
      } else {
        // Row already existed — look it up
        const existing = await client.query(
          `SELECT id FROM users WHERE email = $1`, [email]
        );
        userId = existing.rows[0]?.id;
        if (!userId) {
          console.error(`  ✗ Could not create or find user for ${worker.full_name} — skipping`);
          continue;
        }
      }

      // 4 — Insert unit_membership (skip if already present)
      if (worker.primary_unit_id) {
        await client.query(
          `INSERT INTO unit_memberships (user_id, unit_id, role_code, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [String(userId), String(worker.primary_unit_id), DEFAULT_ROLE]
        );
      }

      // 5 — Link worker → user
      await client.query(
        `UPDATE workers SET linked_user_id = $1, updated_at = NOW() WHERE id = $2`,
        [String(userId), worker.id]
      );

      results.push({ name: worker.full_name, workerCode: worker.worker_code, email, userId });
      console.log(`  ✓ ${worker.full_name}  →  ${email}  (userId=${userId})`);
    }

    // 6 — Summary
    console.log('\n─── Accounts created ───────────────────────────────────────');
    console.log(`${'Name'.padEnd(28)} ${'Email'.padEnd(36)} User ID`);
    console.log('─'.repeat(72));
    results.forEach(r => {
      console.log(`${r.name.padEnd(28)} ${r.email.padEnd(36)} ${r.userId}`);
    });
    console.log('─'.repeat(72));
    console.log(`\nDefault password: ${DEFAULT_PASSWORD}`);
    console.log('Distribute credentials securely. Nurses should change their password on first login.\n');

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
