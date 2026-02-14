/**
 * Database Seeding Template for Schedule Generation
 * 
 * This script creates the minimum required data to run a schedule generation/solver.
 * 
 * Usage:
 * 1. Run: npx ts-node src/database/seeds/example-schedule-seed.ts
 * 2. Or integrate into your seeding workflow
 * 
 * After running this seed, you can trigger the orchestrator with:
 * POST /api/v1/core/orchestrator/run
 * {
 *   "scheduleId": "1", // The schedule ID created by this seed
 *   "dto": {
 *     "startDate": "2026-02-17T00:00:00.000Z",
 *     "endDate": "2026-02-23T00:00:00.000Z"
 *   }
 * }
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { dataSourceOptions } from '../typeorm.config';

// Import entities
import { Organization } from '../entities/core/organization.entity';
import { Site } from '../entities/core/site.entity';
import { Unit } from '../entities/core/unit.entity';
import { User } from '../entities/users/user.entity';
import { Worker, EmploymentType } from '../entities/workers/worker.entity';
import { WorkerUnitMembership } from '../entities/workers/worker-unit.entity';
import { ShiftTemplate } from '../entities/scheduling/shift-template.entity';
import { CoverageRule } from '../entities/scheduling/coverage-rule.entity';
import { ConstraintProfile } from '../entities/scheduling/constraint-profile.entity';
import { Schedule, ScheduleStatus } from '../entities/scheduling/schedule.entity';
import { WorkerAvailability, AvailabilityType } from '../entities/workers/worker-availability.entity';

async function seed() {
  const dataSource = new DataSource(dataSourceOptions());
  await dataSource.initialize();

  console.log('🌱 Starting database seeding...\n');

  try {
    // ============================================================================
    // 1. ORGANIZATION
    // ============================================================================
    console.log('📦 Creating Organization...');
    const orgRepo = dataSource.getRepository(Organization);
    let organization = await orgRepo.findOne({ where: { code: 'DEMO_HOSPITAL' } });
    
    if (!organization) {
      organization = orgRepo.create({
        name: 'Demo Hospital',
        code: 'DEMO_HOSPITAL',
        timezone: 'Asia/Bangkok',
        attributes: {
          description: 'Demo organization for testing solver',
        },
      });
      await orgRepo.save(organization);
      console.log(`   ✓ Organization created: ID=${organization.id}`);
    } else {
      console.log(`   ℹ Organization already exists: ID=${organization.id}`);
    }

    // ============================================================================
    // 2. SITE
    // ============================================================================
    console.log('📦 Creating Site...');
    const siteRepo = dataSource.getRepository(Site);
    let site = await siteRepo.findOne({ 
      where: { organization_id: organization.id, code: 'MAIN_CAMPUS' },
    });
    
    if (!site) {
      site = siteRepo.create({
        organization_id: organization.id,
        name: 'Main Campus',
        code: 'MAIN_CAMPUS',
        address: '123 Hospital Road, Bangkok',
        timezone: 'Asia/Bangkok',
        is_active: true,
        attributes: {},
      });
      await siteRepo.save(site);
      console.log(`   ✓ Site created: ID=${site.id}`);
    } else {
      console.log(`   ℹ Site already exists: ID=${site.id}`);
    }

    // ============================================================================
    // 3. UNIT
    // ============================================================================
    console.log('📦 Creating Unit...');
    const unitRepo = dataSource.getRepository(Unit);
    let unit = await unitRepo.findOne({ 
      where: { organization_id: organization.id, code: 'ICU_01' },
    });
    
    if (!unit) {
      unit = unitRepo.create({
        organization_id: organization.id,
        site_id: site.id,
        name: 'Intensive Care Unit 1',
        code: 'ICU_01',
        description: 'Primary ICU for critical care',
        is_active: true,
        attributes: {
          capacity: 20,
          specialty: 'Critical Care',
        },
      });
      await unitRepo.save(unit);
      console.log(`   ✓ Unit created: ID=${unit.id}`);
    } else {
      console.log(`   ℹ Unit already exists: ID=${unit.id}`);
    }

    // ============================================================================
    // 4. USER (Admin/Creator)
    // ============================================================================
    console.log('📦 Creating Admin User...');
    const userRepo = dataSource.getRepository(User);
    let adminUser = await userRepo.findOne({ where: { email: 'admin@demo.com' } });
    
    if (!adminUser) {
      const passwordHash = await bcrypt.hash('password123', 10);
      adminUser = userRepo.create({
        organization_id: organization.id,
        email: 'admin@demo.com',
        password_hash: passwordHash,
        full_name: 'Admin User',
        is_active: true,
        attributes: {},
      });
      await userRepo.save(adminUser);
      console.log(`   ✓ Admin user created: ID=${adminUser.id}, email=admin@demo.com`);
    } else {
      console.log(`   ℹ Admin user already exists: ID=${adminUser.id}`);
    }

    // ============================================================================
    // 5. WORKERS (Nurses)
    // ============================================================================
    console.log('📦 Creating Workers...');
    const workerRepo = dataSource.getRepository(Worker);
    const workerCodes = ['N001', 'N002', 'N003', 'N004', 'N005', 'N006', 'N007', 'N008'];
    const workers: Worker[] = [];

    for (const code of workerCodes) {
      let worker = await workerRepo.findOne({ 
        where: { organization_id: organization.id, worker_code: code },
      });
      
      if (!worker) {
        worker = workerRepo.create({
          organization_id: organization.id,
          primary_unit_id: unit.id,
          full_name: `Nurse ${code}`,
          worker_code: code,
          employment_type: EmploymentType.FULL_TIME,
          weekly_hours: 40,
          is_active: true,
          attributes: {
            skill_level: code <= 'N004' ? 'SENIOR' : 'JUNIOR',
            certifications: ['BLS', 'ACLS'],
          },
        });
        await workerRepo.save(worker);
        console.log(`   ✓ Worker created: ${code} (ID=${worker.id})`);
      } else {
        console.log(`   ℹ Worker already exists: ${code} (ID=${worker.id})`);
      }
      workers.push(worker);
    }

    // ============================================================================
    // 6. WORKER-UNIT MEMBERSHIPS
    // ============================================================================
    console.log('📦 Creating Worker-Unit Memberships...');
    const membershipRepo = dataSource.getRepository(WorkerUnitMembership);
    
    for (const worker of workers) {
      let membership = await membershipRepo.findOne({
        where: { worker_id: worker.id, unit_id: unit.id },
      });
      
      if (!membership) {
        membership = membershipRepo.create({
          worker_id: worker.id,
          unit_id: unit.id,
          role_code: 'NURSE',
        });
        await membershipRepo.save(membership);
        console.log(`   ✓ Membership created: Worker ${worker.worker_code} → Unit ${unit.code}`);
      }
    }

    // ============================================================================
    // 7. SHIFT TEMPLATES
    // ============================================================================
    console.log('📦 Creating Shift Templates...');
    const shiftRepo = dataSource.getRepository(ShiftTemplate);
    
    const shifts = [
      { code: 'DAY', name: 'Day Shift', start: '07:00:00', end: '15:00:00' },
      { code: 'EVENING', name: 'Evening Shift', start: '15:00:00', end: '23:00:00' },
      { code: 'NIGHT', name: 'Night Shift', start: '23:00:00', end: '07:00:00' },
      { code: 'OFF', name: 'Off Day', start: '00:00:00', end: '00:00:00' },
    ];

    for (const shift of shifts) {
      let template = await shiftRepo.findOne({
        where: { organization_id: organization.id, unit_id: unit.id, code: shift.code },
      });
      
      if (!template) {
        template = shiftRepo.create({
          organization_id: organization.id,
          unit_id: unit.id,
          code: shift.code,
          name: shift.name,
          start_time: shift.start,
          end_time: shift.end,
          is_active: true,
          attributes: {
            is_rest: shift.code === 'OFF',
            duration_hours: shift.code === 'OFF' ? 0 : 8,
          },
        });
        await shiftRepo.save(template);
        console.log(`   ✓ Shift template created: ${shift.code}`);
      } else {
        console.log(`   ℹ Shift template already exists: ${shift.code}`);
      }
    }

    // ============================================================================
    // 8. COVERAGE RULES
    // ============================================================================
    console.log('📦 Creating Coverage Rules...');
    const coverageRepo = dataSource.getRepository(CoverageRule);
    
    const coverageRules = [
      // Weekday coverage
      { shiftCode: 'DAY', dayType: 'WEEKDAY', minWorkers: 3, maxWorkers: 4 },
      { shiftCode: 'EVENING', dayType: 'WEEKDAY', minWorkers: 2, maxWorkers: 3 },
      { shiftCode: 'NIGHT', dayType: 'WEEKDAY', minWorkers: 2, maxWorkers: 3 },
      
      // Weekend coverage
      { shiftCode: 'DAY', dayType: 'WEEKEND', minWorkers: 2, maxWorkers: 3 },
      { shiftCode: 'EVENING', dayType: 'WEEKEND', minWorkers: 2, maxWorkers: 2 },
      { shiftCode: 'NIGHT', dayType: 'WEEKEND', minWorkers: 2, maxWorkers: 2 },
    ];

    for (const rule of coverageRules) {
      let coverage = await coverageRepo.findOne({
        where: { 
          unit_id: unit.id, 
          shift_code: rule.shiftCode,
          day_type: rule.dayType,
        },
      });
      
      if (!coverage) {
        coverage = coverageRepo.create({
          unit_id: unit.id,
          shift_code: rule.shiftCode,
          day_type: rule.dayType,
          min_workers: rule.minWorkers,
          max_workers: rule.maxWorkers,
          required_tag: null,
          attributes: {},
        });
        await coverageRepo.save(coverage);
        console.log(`   ✓ Coverage rule created: ${rule.shiftCode} ${rule.dayType}`);
      }
    }

    // ============================================================================
    // 9. CONSTRAINT PROFILE
    // ============================================================================
    console.log('📦 Creating Constraint Profile...');
    const constraintRepo = dataSource.getRepository(ConstraintProfile);
    let constraintProfile = await constraintRepo.findOne({
      where: { unit_id: unit.id, name: 'Default ICU Constraints' },
    });
    
    if (!constraintProfile) {
      constraintProfile = constraintRepo.create({
        unit_id: unit.id,
        name: 'Default ICU Constraints',
        max_consecutive_work_days: 5,
        max_consecutive_night_shifts: 3,
        min_rest_hours_between_shifts: 12,
        fairness_weight_json: {
          shift_distribution: 1.0,
          workload_balance: 1.0,
        },
        penalty_weight_json: {
          consecutive_days_penalty: 5,
          night_shift_penalty: 2,
        },
        is_active: true,
        attributes: {
          description: 'Standard constraints for ICU scheduling',
        },
      });
      await constraintRepo.save(constraintProfile);
      console.log(`   ✓ Constraint profile created: ID=${constraintProfile.id}`);
    } else {
      console.log(`   ℹ Constraint profile already exists: ID=${constraintProfile.id}`);
    }

    // ============================================================================
    // 10. SCHEDULE CONTAINER
    // ============================================================================
    console.log('📦 Creating Schedule...');
    const scheduleRepo = dataSource.getRepository(Schedule);
    
    // Create a schedule for the upcoming week
    const startDate = '2026-02-17'; // Next Monday
    const endDate = '2026-02-23';   // Next Sunday
    
    let schedule = await scheduleRepo.findOne({
      where: { 
        unit_id: unit.id,
        start_date: startDate,
        end_date: endDate,
      },
    });
    
    if (!schedule) {
      schedule = scheduleRepo.create({
        organization_id: organization.id,
        unit_id: unit.id,
        name: `ICU Schedule Week 2026-02-17`,
        start_date: startDate,
        end_date: endDate,
        status: ScheduleStatus.DRAFT,
        constraint_profile_id: constraintProfile.id,
        created_by: adminUser.id,
        job_id: null,
        last_solver_run_id: null,
        attributes: {
          notes: 'Demo schedule for solver testing',
        },
      });
      await scheduleRepo.save(schedule);
      console.log(`   ✓ Schedule created: ID=${schedule.id}`);
    } else {
      console.log(`   ℹ Schedule already exists: ID=${schedule.id}`);
    }

    // ============================================================================
    // 11. WORKER AVAILABILITY (Optional but recommended)
    // ============================================================================
    console.log('📦 Creating Worker Availability...');
    const availabilityRepo = dataSource.getRepository(WorkerAvailability);
    
    // Make all workers available for all shifts during the schedule period
    // Note: WorkerAvailability tracks per-shift, per-day availability
    const availableShifts = ['DAY', 'EVENING', 'NIGHT'];
    
    for (const worker of workers) {
      for (const shiftCode of availableShifts) {
        let availability = await availabilityRepo.findOne({
          where: { 
            worker_id: worker.id,
            unit_id: unit.id,
            date: startDate,
            shift_code: shiftCode,
          },
        });
        
        if (!availability) {
          availability = availabilityRepo.create({
            worker_id: worker.id,
            unit_id: unit.id,
            date: startDate,
            shift_code: shiftCode,
            type: AvailabilityType.AVAILABLE,
            source: 'SEED',
            reason: null,
            attributes: {},
          });
          await availabilityRepo.save(availability);
          console.log(`   ✓ Availability created: Worker ${worker.worker_code} - ${shiftCode}`);
        }
      }
    }

    // ============================================================================
    // SUMMARY
    // ============================================================================
    console.log('\n✅ Seeding completed successfully!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 SUMMARY:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`   Organization ID: ${organization.id}`);
    console.log(`   Site ID:         ${site.id}`);
    console.log(`   Unit ID:         ${unit.id}`);
    console.log(`   Unit Code:       ${unit.code}`);
    console.log(`   Admin User ID:   ${adminUser.id}`);
    console.log(`   Admin Email:     admin@demo.com`);
    console.log(`   Admin Password:  password123`);
    console.log(`   Schedule ID:     ${schedule.id}`);
    console.log(`   Schedule Period: ${startDate} to ${endDate}`);
    console.log(`   Workers:         ${workers.length} nurses created`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('🚀 NEXT STEPS:\n');
    console.log('1. Get JWT token:');
    console.log('   POST /api/v1/core/auth/login');
    console.log('   Body: { "email": "admin@demo.com", "password": "password123" }\n');
    
    console.log('2. Trigger solver (with JWT token):');
    console.log('   POST /api/v1/core/orchestrator/run');
    console.log('   Body:');
    console.log('   {');
    console.log(`     "scheduleId": "${schedule.id}",`);
    console.log('     "dto": {');
    console.log(`       "startDate": "${startDate}T00:00:00.000Z",`);
    console.log(`       "endDate": "${endDate}T23:59:59.999Z"`);
    console.log('     }');
    console.log('   }\n');
    
    console.log('3. Check job status:');
    console.log('   GET /api/v1/core/jobs/{jobId}\n');
    
    console.log('4. Preview results:');
    console.log('   GET /api/v1/core/jobs/{jobId}/preview\n');
    
    console.log('5. Apply schedule:');
    console.log('   POST /api/v1/core/jobs/{jobId}/apply\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

// Run the seed
seed()
  .then(() => {
    console.log('🏁 Seed script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
