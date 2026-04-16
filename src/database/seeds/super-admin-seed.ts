/**
 * Super Admin Account Seed
 *
 * Creates a permanent super_admin user for platform/dev access.
 * Safe to re-run — all steps are idempotent (upsert-style).
 *
 * Usage:
 *   cd maywin_core_backend_main
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/super-admin-seed.ts
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { dataSourceOptions } from '../typeorm.config';

import { Organization } from '../entities/core/organization.entity';
import { User } from '../entities/users/user.entity';
import { Role } from '../entities/users/role.entity';
import { UserRole } from '../entities/users/user-role.entity';

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPER_ADMIN = {
  email:     'ken@maywin.dev',
  password:  'MayWinDev2026!',   // change after first login
  fullName:  'Ken (Dev)',
  roleCode:  'super_admin',
  roleName:  'Super Administrator',
};

// Uses the MAYWIN_DEMO org if it exists; otherwise creates a minimal dev org.
const DEV_ORG = {
  code: 'MAYWIN_DEMO',
  name: 'MayWin Demo Hospital',
};

// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  const dataSource = new DataSource(dataSourceOptions());
  await dataSource.initialize();
  console.log('🌱 Super admin seed starting...\n');

  try {
    // ── 1. Organisation (reuse existing or create dev org) ───────────────────
    const orgRepo = dataSource.getRepository(Organization);
    let org = await orgRepo.findOne({ where: { code: DEV_ORG.code } });
    if (!org) {
      org = orgRepo.create({
        name: DEV_ORG.name,
        code: DEV_ORG.code,
        timezone: 'Asia/Bangkok',
        attributes: { description: 'Dev / demo org' },
      });
      await orgRepo.save(org);
      console.log(`   ✓ Created org  "${org.name}"  ID=${org.id}`);
    } else {
      console.log(`   ℹ Org exists   "${org.name}"  ID=${org.id}`);
    }

    // ── 2. Role ──────────────────────────────────────────────────────────────
    const roleRepo = dataSource.getRepository(Role);
    let role = await roleRepo.findOne({ where: { code: SUPER_ADMIN.roleCode } });
    if (!role) {
      role = roleRepo.create({
        code: SUPER_ADMIN.roleCode,
        name: SUPER_ADMIN.roleName,
        description: 'Full platform access — dev / ops only',
      });
      await roleRepo.save(role);
      console.log(`   ✓ Created role "${role.code}"  ID=${role.id}`);
    } else {
      console.log(`   ℹ Role exists  "${role.code}"  ID=${role.id}`);
    }

    // ── 3. User ──────────────────────────────────────────────────────────────
    const userRepo = dataSource.getRepository(User);
    let user = await userRepo.findOne({ where: { email: SUPER_ADMIN.email } });
    if (!user) {
      user = userRepo.create({
        organization_id: org.id,
        email:           SUPER_ADMIN.email,
        password_hash:   await bcrypt.hash(SUPER_ADMIN.password, 10),
        full_name:       SUPER_ADMIN.fullName,
        is_active:       true,
        attributes:      { role_hint: SUPER_ADMIN.roleCode },
      });
      await userRepo.save(user);
      console.log(`   ✓ Created user "${user.email}"  ID=${user.id}`);
    } else {
      console.log(`   ℹ User exists  "${user.email}"  ID=${user.id}`);
    }

    // ── 4. User ↔ Role link ──────────────────────────────────────────────────
    const userRoleRepo = dataSource.getRepository(UserRole);
    const existingLink = await userRoleRepo.findOne({
      where: { user_id: String(user.id), role_id: String(role.id) },
    });
    if (!existingLink) {
      await userRoleRepo.save(
        userRoleRepo.create({ user_id: String(user.id), role_id: String(role.id) }),
      );
      console.log(`   ✓ Linked user → role`);
    } else {
      console.log(`   ℹ Link exists  user_id=${user.id} role_id=${role.id}`);
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('✅ Super admin ready\n');
    console.log(`   Email    :  ${SUPER_ADMIN.email}`);
    console.log(`   Password :  ${SUPER_ADMIN.password}`);
    console.log(`   Role     :  ${SUPER_ADMIN.roleCode}`);
    console.log(`   Org      :  ${org.name}  (ID=${org.id})`);
    console.log(`   User ID  :  ${user.id}`);
    console.log('\n   Login → POST /api/v1/core/auth/login');
    console.log('══════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Seed failed:', err);
    throw err;
  } finally {
    await dataSource.destroy();
  }
}

seed()
  .then(() => { console.log('🏁 Done.'); process.exit(0); })
  .catch(() => process.exit(1));
