/**
 * April 2026 Real-Data Seed
 *
 * Based on nurse_schedule_with_preferences.json
 * 7 nurses (N1-N7), 30 days (2026-04-01 to 2026-04-30)
 * Shifts: Morning, Evening, Night
 * Demand per day: Morning=2, Evening=1, Night=1
 * N7 is a backup nurse (is_backup_worker=true)
 * N1, N4, N7 have "Senior" skill
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/april-2026-seed.ts
 *
 * After seeding, trigger solver:
 *   POST /api/v1/core/orchestrator/run
 *   { "scheduleId": "<schedule_id>", "dto": { "startDate": "2026-04-01T00:00:00.000Z", "endDate": "2026-04-30T23:59:59.999Z" } }
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { dataSourceOptions } from '../typeorm.config';

import { Organization } from '../entities/core/organization.entity';
import { Site } from '../entities/core/site.entity';
import { Unit } from '../entities/core/unit.entity';
import { User } from '../entities/users/user.entity';
import { Worker, EmploymentType } from '../entities/workers/worker.entity';
import { WorkerUnitMembership } from '../entities/workers/worker-unit.entity';
import { WorkerPreference } from '../entities/workers/worker-preferences.entity';
import { ShiftTemplate } from '../entities/scheduling/shift-template.entity';
import { CoverageRule } from '../entities/scheduling/coverage-rule.entity';
import { ConstraintProfile } from '../entities/scheduling/constraint-profile.entity';
import { Schedule, ScheduleStatus } from '../entities/scheduling/schedule.entity';

// ─── Seed config derived from nurse_schedule_with_preferences.json ────────────

const START_DATE = '2026-04-01';
const END_DATE   = '2026-04-30';

/** nurse_code → { isBackup, skills, regularShifts, maxOvertime } */
const NURSE_DEFS = [
  { code: 'N1', name: 'นางสาวภวัตสรรค์ นิลจันทร์',   skills: ['Senior'], isBackup: false, regular: 20, maxOT: 10 },
  { code: 'N2', name: 'นางสาวศิรินรัตน์ จิตรหวล',      skills: [],         isBackup: false, regular: 20, maxOT: 10 },
  { code: 'N3', name: 'นางสาวสุลักษณา เยนา',           skills: [],         isBackup: false, regular: 20, maxOT: 10 },
  { code: 'N4', name: 'นางสาวรัตนาวลี สัตยวิวัฒน์',   skills: ['Senior'], isBackup: false, regular: 20, maxOT: 10 },
  { code: 'N5', name: 'นางสาวธนัชพร ด่านตระกูล',       skills: [],         isBackup: false, regular: 20, maxOT: 10 },
  { code: 'N6', name: 'นางสาวพรลภัส รุ่งเรือง',        skills: [],         isBackup: false, regular: 20, maxOT: 10 },
  { code: 'N7', name: 'นางสาวปรัชญาภร ศรีจันทร์',      skills: [],         isBackup: false, regular: 20, maxOT: 10 },
  { code: 'N8', name: 'มาย',                            skills: ['Senior'], isBackup: true,  regular: 0,  maxOT: 15 },
] as const;

/** Per-nurse explicit preferences: { nurseCode: { date: { shiftCode: penalty } } }
 *  Positive penalty = "prefer NOT to work this shift on this date" in solver cost.
 *  (Score 5 in JSON → high preference, maps to penalty 5 in solver.)
 */
const NURSE_PREFERENCES: Record<string, Record<string, Record<string, number>>> = {
  N1: {
    '2026-04-05': { Night: 5 },
    '2026-04-12': { Evening: 3 },
  },
  N2: {
    '2026-04-10': { Night: 5 },
  },
  N3: {
    '2026-04-15': { Morning: 2 },
  },
};

// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  const dataSource = new DataSource(dataSourceOptions());
  await dataSource.initialize();

  console.log('🌱 Starting April 2026 seed...\n');

  try {
    // ── 1. Organization ──────────────────────────────────────────────────────
    console.log('📦 Organization...');
    const orgRepo = dataSource.getRepository(Organization);
    let org = await orgRepo.findOne({ where: { code: 'MAYWIN_DEMO' } });
    if (!org) {
      org = orgRepo.create({
        name: 'MayWin Demo Hospital',
        code: 'MAYWIN_DEMO',
        timezone: 'Asia/Bangkok',
        attributes: { description: 'Seeded via april-2026-seed.ts' },
      });
      await orgRepo.save(org);
      console.log(`   ✓ Created org ID=${org.id}`);
    } else {
      console.log(`   ℹ Exists ID=${org.id}`);
    }

    // ── 2. Site ──────────────────────────────────────────────────────────────
    console.log('📦 Site...');
    const siteRepo = dataSource.getRepository(Site);
    let site = await siteRepo.findOne({ where: { organization_id: org.id, code: 'MAIN_SITE' } });
    if (!site) {
      site = siteRepo.create({
        organization_id: org.id,
        name: 'Main Site',
        code: 'MAIN_SITE',
        address: '1 Hospital Road, Bangkok',
        timezone: 'Asia/Bangkok',
        is_active: true,
        attributes: {},
      });
      await siteRepo.save(site);
      console.log(`   ✓ Created site ID=${site.id}`);
    } else {
      console.log(`   ℹ Exists ID=${site.id}`);
    }

    // ── 3. Unit ──────────────────────────────────────────────────────────────
    console.log('📦 Unit...');
    const unitRepo = dataSource.getRepository(Unit);
    let unit = await unitRepo.findOne({ where: { organization_id: org.id, code: 'WARD_A' } });
    if (!unit) {
      unit = unitRepo.create({
        organization_id: org.id,
        site_id: site.id,
        name: 'Ward A',
        code: 'WARD_A',
        description: 'General nursing ward — April 2026 demo',
        is_active: true,
        attributes: { specialty: 'General Care' },
      });
      await unitRepo.save(unit);
      console.log(`   ✓ Created unit ID=${unit.id}`);
    } else {
      console.log(`   ℹ Exists ID=${unit.id}`);
    }

    // ── 4. Admin User ────────────────────────────────────────────────────────
    console.log('📦 Admin user...');
    const userRepo = dataSource.getRepository(User);
    let adminUser = await userRepo.findOne({ where: { email: 'admin@maywin-demo.com' } });
    if (!adminUser) {
      adminUser = userRepo.create({
        organization_id: org.id,
        email: 'admin@maywin-demo.com',
        password_hash: await bcrypt.hash('password123', 10),
        full_name: 'Admin MayWin',
        is_active: true,
        attributes: {},
      });
      await userRepo.save(adminUser);
      console.log(`   ✓ Created user ID=${adminUser.id}`);
    } else {
      console.log(`   ℹ Exists ID=${adminUser.id}`);
    }

    // ── 5. Workers (N1–N7) ───────────────────────────────────────────────────
    console.log('📦 Workers...');
    const workerRepo = dataSource.getRepository(Worker);
    const workers: Worker[] = [];

    for (const def of NURSE_DEFS) {
      let worker = await workerRepo.findOne({
        where: { organization_id: org.id, worker_code: def.code },
      });

      if (!worker) {
        worker = workerRepo.create({
          organization_id: org.id,
          primary_unit_id: unit.id,
          full_name: def.name,
          worker_code: def.code,
          employment_type: def.isBackup ? EmploymentType.PART_TIME : EmploymentType.FULL_TIME,
          weekly_hours: def.isBackup ? null : 40,
          is_active: true,
          is_backup_worker: def.isBackup,
          regular_shifts_per_period: def.regular > 0 ? def.regular : null,
          max_overtime_shifts: def.maxOT,
          min_shifts_per_period: null,
          attributes: {
            // skills are read by normalizer via extractWorkerTags → attributes.skills
            skills: def.skills,
            certifications: ['BLS'],
          },
        });
        await workerRepo.save(worker);
        console.log(`   ✓ Created ${def.code} (backup=${def.isBackup}, skills=${def.skills.join(',') || 'none'}) ID=${worker.id}`);
      } else {
        // Update name + v3 fields
        worker.full_name = def.name;
        worker.is_backup_worker = def.isBackup;
        worker.regular_shifts_per_period = def.regular > 0 ? def.regular : null;
        worker.max_overtime_shifts = def.maxOT;
        worker.attributes = { ...worker.attributes, skills: def.skills };
        await workerRepo.save(worker);
        console.log(`   ℹ Updated ${def.code} → ${def.name} ID=${worker.id}`);
      }

      workers.push(worker);
    }

    // ── 6. Worker-Unit Memberships ────────────────────────────────────────────
    console.log('📦 Memberships...');
    const memberRepo = dataSource.getRepository(WorkerUnitMembership);
    for (const worker of workers) {
      const existing = await memberRepo.findOne({
        where: { worker_id: worker.id, unit_id: unit.id },
      });
      if (!existing) {
        await memberRepo.save(memberRepo.create({ worker_id: worker.id, unit_id: unit.id, role_code: 'NURSE' }));
        console.log(`   ✓ Linked ${worker.worker_code} → ${unit.code}`);
      }
    }

    // ── 7. Shift Templates ────────────────────────────────────────────────────
    console.log('📦 Shift templates...');
    const shiftRepo = dataSource.getRepository(ShiftTemplate);

    const shiftDefs = [
      { code: 'Morning', name: 'Morning Shift', start: '07:00:00', end: '15:00:00', hours: 8 },
      { code: 'Evening', name: 'Evening Shift', start: '15:00:00', end: '23:00:00', hours: 8 },
      { code: 'Night',   name: 'Night Shift',   start: '23:00:00', end: '07:00:00', hours: 8 },
      { code: 'OFF',     name: 'Off Day',        start: '00:00:00', end: '00:00:00', hours: 0 },
    ];

    for (const s of shiftDefs) {
      let tmpl = await shiftRepo.findOne({
        where: { organization_id: org.id, unit_id: unit.id, code: s.code },
      });
      if (!tmpl) {
        tmpl = shiftRepo.create({
          organization_id: org.id,
          unit_id: unit.id,
          code: s.code,
          name: s.name,
          start_time: s.start,
          end_time: s.end,
          is_active: true,
          attributes: { is_rest: s.code === 'OFF', duration_hours: s.hours },
        });
        await shiftRepo.save(tmpl);
        console.log(`   ✓ Created shift ${s.code}`);
      } else {
        console.log(`   ℹ Exists shift ${s.code}`);
      }
    }

    // ── 8. Coverage Rules ─────────────────────────────────────────────────────
    // From JSON demand: Morning=2, Evening=1, Night=1 (same every day → same for WEEKDAY/WEEKEND)
    console.log('📦 Coverage rules...');
    const coverageRepo = dataSource.getRepository(CoverageRule);

    const coverageDefs = [
      { shift: 'Morning', dayType: 'WEEKDAY', min: 2, max: 2 },
      { shift: 'Evening', dayType: 'WEEKDAY', min: 1, max: 1 },
      { shift: 'Night',   dayType: 'WEEKDAY', min: 1, max: 1 },
      { shift: 'Morning', dayType: 'WEEKEND', min: 2, max: 2 },
      { shift: 'Evening', dayType: 'WEEKEND', min: 1, max: 1 },
      { shift: 'Night',   dayType: 'WEEKEND', min: 1, max: 1 },
    ];

    for (const c of coverageDefs) {
      const existing = await coverageRepo.findOne({
        where: { unit_id: unit.id, shift_code: c.shift, day_type: c.dayType },
      });
      if (!existing) {
        await coverageRepo.save(coverageRepo.create({
          unit_id: unit.id,
          shift_code: c.shift,
          day_type: c.dayType,
          min_workers: c.min,
          max_workers: c.max,
          required_tag: null, // No global skill requirement; see note below
          attributes: {},
        }));
        console.log(`   ✓ Coverage ${c.shift}/${c.dayType} min=${c.min} max=${c.max}`);
      } else {
        console.log(`   ℹ Exists ${c.shift}/${c.dayType}`);
      }
    }
    // NOTE: The JSON has required_skills only on 4 specific nights (Apr 1, 10, 20, 30).
    // Since coverage rules are per day_type (not per date), we skip the global Senior requirement
    // to avoid making 30 nights Senior-only. The solver will still produce valid schedules.

    // ── 9. Constraint Profile ─────────────────────────────────────────────────
    // Maps rules, fairness_weights, time_limit from the JSON.
    console.log('📦 Constraint profile...');
    const constraintRepo = dataSource.getRepository(ConstraintProfile);
    let cp = await constraintRepo.findOne({
      where: { unit_id: unit.id, name: 'April 2026 Ward A Profile' },
    });
    if (!cp) {
      cp = constraintRepo.create({
        unit_id: unit.id,
        name: 'April 2026 Ward A Profile',

        // Sequence / rest
        max_consecutive_work_days: null,       // not specified in JSON, use solver default
        max_consecutive_night_shifts: null,
        min_rest_hours_between_shifts: null,

        // From JSON rules
        max_shifts_per_day: 2,                // rules.max_shifts_per_day
        max_nights_per_week: 2,               // rules.max_nights_per_week
        min_days_off_per_week: 2,             // not in JSON, reasonable default
        forbid_night_to_morning: true,         // rules.forbid_night_to_morning
        forbid_morning_to_night_same_day: false,

        // Coverage / emergency toggles (sensible defaults)
        guarantee_full_coverage: true,
        allow_emergency_overrides: true,
        allow_second_shift_same_day_in_emergency: true,
        ignore_availability_in_emergency: false,
        allow_night_cap_override_in_emergency: true,
        allow_rest_rule_override_in_emergency: true,

        // Goals
        goal_minimize_staff_cost: true,
        goal_maximize_preference_satisfaction: true,
        goal_balance_workload: true,          // weight > 0 in JSON
        goal_balance_night_workload: true,    // night_balance weight > 0 in JSON
        goal_reduce_undesirable_shifts: true,

        // From JSON fairness_weights
        fairness_weight_json: {
          workload_balance: 1,
          night_balance: 2,
          shift_type_balance: 2,
        },

        penalty_weight_json: null,  // not specified in JSON, solver uses defaults

        goal_priority_json: null,   // not specified, solver uses defaults

        // From JSON time_limit_sec
        time_limit_sec: 15,
        num_search_workers: 8,

        is_active: true,
        attributes: {},
      });
      await constraintRepo.save(cp);
      console.log(`   ✓ Created constraint profile ID=${cp.id}`);
    } else {
      console.log(`   ℹ Exists constraint profile ID=${cp.id}`);
    }

    // ── 10. Schedule ──────────────────────────────────────────────────────────
    console.log('📦 Schedule...');
    const scheduleRepo = dataSource.getRepository(Schedule);
    let schedule = await scheduleRepo.findOne({
      where: { unit_id: unit.id, start_date: START_DATE, end_date: END_DATE },
    });
    if (!schedule) {
      schedule = scheduleRepo.create({
        organization_id: org.id,
        unit_id: unit.id,
        name: 'Ward A — April 2026',
        start_date: START_DATE,
        end_date: END_DATE,
        status: ScheduleStatus.DRAFT,
        constraint_profile_id: cp.id,
        created_by: adminUser.id,
        job_id: null,
        last_solver_run_id: null,
        attributes: { notes: 'Seeded from nurse_schedule_with_preferences.json' },
      });
      await scheduleRepo.save(schedule);
      console.log(`   ✓ Created schedule ID=${schedule.id}`);
    } else {
      console.log(`   ℹ Exists schedule ID=${schedule.id}`);
    }

    // ── 11. Worker Preferences (explicit per-date, per-shift) ─────────────────
    // Store in preference_pattern_json: { date: { shiftCode: penalty } }
    console.log('📦 Worker preferences...');
    const prefRepo = dataSource.getRepository(WorkerPreference);

    for (const worker of workers) {
      const nurseCode = worker.worker_code!;
      const pattern = NURSE_PREFERENCES[nurseCode];
      if (!pattern) continue; // no preferences for this nurse

      let pref = await prefRepo.findOne({ where: { worker_id: worker.id } });
      if (!pref) {
        pref = prefRepo.create({
          worker_id: worker.id,
          prefers_day_shifts: null,
          prefers_night_shifts: null,
          max_consecutive_work_days: null,
          max_consecutive_night_shifts: null,
          preference_pattern_json: pattern,
          days_off_pattern_json: null,
          attributes: {},
        });
        await prefRepo.save(pref);
        console.log(`   ✓ Preferences for ${nurseCode}: ${JSON.stringify(pattern)}`);
      } else {
        // Merge new pattern over existing
        const merged = { ...(pref.preference_pattern_json ?? {}), ...pattern };
        pref.preference_pattern_json = merged;
        await prefRepo.save(pref);
        console.log(`   ℹ Updated preferences for ${nurseCode}`);
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n✅ Seeding complete!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 SUMMARY:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`   Org ID:          ${org.id}  (${org.code})`);
    console.log(`   Unit ID:         ${unit.id}  (${unit.code})`);
    console.log(`   Schedule ID:     ${schedule.id}`);
    console.log(`   Period:          ${START_DATE} → ${END_DATE}`);
    console.log(`   Nurses:          ${workers.length}  (N1–N8, N8=มาย is backup)`);
    console.log(`   Admin email:     admin@maywin-demo.com`);
    console.log(`   Admin password:  password123`);
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('🚀 NEXT STEPS:\n');
    console.log('1. Login:');
    console.log('   POST /api/v1/core/auth/login');
    console.log('   { "email": "admin@maywin-demo.com", "password": "password123" }\n');
    console.log('2. Run solver:');
    console.log('   POST /api/v1/core/orchestrator/run');
    console.log('   {');
    console.log(`     "scheduleId": "${schedule.id}",`);
    console.log('     "dto": {');
    console.log(`       "startDate": "${START_DATE}T00:00:00.000Z",`);
    console.log(`       "endDate": "${END_DATE}T23:59:59.999Z"`);
    console.log('     }');
    console.log('   }\n');
    console.log('3. Poll job:  GET /api/v1/core/jobs/{jobId}');
    console.log('4. Preview:   GET /api/v1/core/jobs/{jobId}/preview');
    console.log('5. Apply:     POST /api/v1/core/jobs/{jobId}/apply\n');

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
