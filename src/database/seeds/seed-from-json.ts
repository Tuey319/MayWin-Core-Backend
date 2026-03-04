/**
 * Database Seeding from JSON Test Data
 * 
 * Seeds database with 60 nurses and January 2026 schedule data
 * from test_60nurses_jan2026_business_only_availability.json
 * 
 * Usage:
 * npx ts-node src/database/seeds/seed-from-json.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.development
dotenv.config({ path: path.join(process.cwd(), '.env.development') });

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
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

interface JsonData {
  nurses: string[];
  days: string[];
  shifts: string[];
  demand: Record<string, Record<string, number>>;
  availability: Record<string, Record<string, Record<string, number>>>;
  totalShifts?: Record<string, number>;
}

async function seed() {
  // Load JSON data
  const jsonPath = path.join(process.cwd(), 'test_60nurses_jan2026_business_only_availability.json');
  console.log(`📄 Loading data from: ${jsonPath}\n`);
  
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON file not found: ${jsonPath}`);
  }

  const jsonData: JsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  
  console.log(`✓ Loaded: ${jsonData.nurses.length} nurses, ${jsonData.days.length} days, ${jsonData.shifts.length} shifts\n`);

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
        name: 'Latkrabang Hospital',
        code: 'LATKRABANG_HOSPITAL',
        timezone: 'Asia/Bangkok',
        attributes: {
          description: 'Latkrabang Demo hospital for 60-nurse solver testing',
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
        name: 'Pra Chom Klao Campus',
        code: 'PCK_CAMPUS',
        address: 'Chalongkrung Road, Bangkok',
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
        description: 'ICU with 60 nurses - January 2026 test data',
        is_active: true,
        attributes: {
          capacity: 30,
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
    // 5. WORKERS (60 Nurses from JSON)
    // ============================================================================
    console.log(`📦 Creating ${jsonData.nurses.length} Workers...`);
    const workerRepo = dataSource.getRepository(Worker);
    const workers: Worker[] = [];
    const workerByCode: Record<string, Worker> = {};

    for (const nurseCode of jsonData.nurses) {
      let worker = await workerRepo.findOne({ 
        where: { organization_id: organization.id, worker_code: nurseCode },
      });
      
      if (!worker) {
        worker = workerRepo.create({
          organization_id: organization.id,
          primary_unit_id: unit.id,
          full_name: `Nurse ${nurseCode}`,
          worker_code: nurseCode,
          employment_type: EmploymentType.FULL_TIME,
          weekly_hours: 40,
          is_active: true,
          attributes: {
            skill_level: 'STANDARD',
            certifications: ['BLS', 'ACLS'],
          },
        });
        await workerRepo.save(worker);
      }
      workers.push(worker);
      workerByCode[nurseCode] = worker;
    }
    console.log(`   ✓ ${workers.length} workers created/verified`);

    // ============================================================================
    // 6. WORKER-UNIT MEMBERSHIPS
    // ============================================================================
    console.log('📦 Creating Worker-Unit Memberships...');
    const membershipRepo = dataSource.getRepository(WorkerUnitMembership);
    let membershipCount = 0;
    
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
        membershipCount++;
      }
    }
    console.log(`   ✓ ${membershipCount} memberships created`);

    // ============================================================================
    // 7. SHIFT TEMPLATES (from JSON shifts)
    // ============================================================================
    console.log('📦 Creating Shift Templates...');
    const shiftRepo = dataSource.getRepository(ShiftTemplate);
    
    const shiftMappings = [
      { code: 'Morning', name: 'Morning Shift', start: '07:00:00', end: '15:00:00' },
      { code: 'Evening', name: 'Evening Shift', start: '15:00:00', end: '23:00:00' },
      { code: 'Night', name: 'Night Shift', start: '23:00:00', end: '07:00:00' },
      { code: 'OFF', name: 'Off Day', start: '00:00:00', end: '00:00:00' },
    ];

    for (const shift of shiftMappings) {
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
      }
    }

    // ============================================================================
    // 8. COVERAGE RULES (from JSON demand)
    // ============================================================================
    console.log('📦 Creating Coverage Rules from demand data...');
    const coverageRepo = dataSource.getRepository(CoverageRule);
    
    // Calculate average demand per shift for weekday/weekend
    const demandsByDayType: Record<string, Record<string, number[]>> = {
      WEEKDAY: { Morning: [], Evening: [], Night: [] },
      WEEKEND: { Morning: [], Evening: [], Night: [] },
    };

    for (const dateStr of jsonData.days) {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const dayType = (dayOfWeek === 0 || dayOfWeek === 6) ? 'WEEKEND' : 'WEEKDAY';
      
      const demand = jsonData.demand[dateStr];
      if (demand) {
        for (const shiftCode of jsonData.shifts) {
          if (demand[shiftCode] !== undefined) {
            demandsByDayType[dayType][shiftCode].push(demand[shiftCode]);
          }
        }
      }
    }

    // Create coverage rules based on min/max/avg demand
    for (const dayType of ['WEEKDAY', 'WEEKEND']) {
      for (const shiftCode of jsonData.shifts) {
        const demands = demandsByDayType[dayType][shiftCode];
        if (demands.length === 0) continue;

        const minDemand = Math.min(...demands);
        const maxDemand = Math.max(...demands);
        const avgDemand = Math.round(demands.reduce((a, b) => a + b, 0) / demands.length);

        let coverage = await coverageRepo.findOne({
          where: { 
            unit_id: unit.id, 
            shift_code: shiftCode,
            day_type: dayType,
          },
        });
        
        if (!coverage) {
          coverage = coverageRepo.create({
            unit_id: unit.id,
            shift_code: shiftCode,
            day_type: dayType,
            min_workers: minDemand,
            max_workers: maxDemand + 2, // Add buffer for flexibility
            required_tag: null,
            attributes: {
              avg_demand: avgDemand,
              source: 'json_demand_data',
            },
          });
          await coverageRepo.save(coverage);
          console.log(`   ✓ Coverage rule: ${shiftCode} ${dayType} (min=${minDemand}, max=${maxDemand + 2})`);
        }
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
          description: 'Standard constraints for 60-nurse ICU scheduling',
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
    
    const startDate = jsonData.days[0]; // 2026-01-01
    const endDate = jsonData.days[jsonData.days.length - 1]; // 2026-01-31
    
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
        name: `ICU Schedule January 2026 (60 nurses)`,
        start_date: startDate,
        end_date: endDate,
        status: ScheduleStatus.DRAFT,
        constraint_profile_id: constraintProfile.id,
        created_by: adminUser.id,
        job_id: null,
        last_solver_run_id: null,
        attributes: {
          notes: '60 nurses, January 2026 test data with real availability',
          source: 'test_60nurses_jan2026_business_only_availability.json',
        },
      });
      await scheduleRepo.save(schedule);
      console.log(`   ✓ Schedule created: ID=${schedule.id}`);
    } else {
      console.log(`   ℹ Schedule already exists: ID=${schedule.id}`);
    }

    // ============================================================================
    // 11. WORKER AVAILABILITY (from JSON availability data)
    // ============================================================================
    console.log('📦 Creating Worker Availability from JSON data...');
    const availabilityRepo = dataSource.getRepository(WorkerAvailability);
    
    let availabilityCount = 0;
    let skippedCount = 0;

    for (const nurseCode of jsonData.nurses) {
      const worker = workerByCode[nurseCode];
      if (!worker) continue;

      const nurseAvailability = jsonData.availability[nurseCode];
      if (!nurseAvailability) continue;

      for (const dateStr of jsonData.days) {
        const dayAvailability = nurseAvailability[dateStr];
        if (!dayAvailability) continue;

        for (const shiftCode of jsonData.shifts) {
          const isAvailable = dayAvailability[shiftCode];
          
          // Only create availability records (skip if 0/unavailable for efficiency)
          if (isAvailable === 1) {
            let availability = await availabilityRepo.findOne({
              where: { 
                worker_id: worker.id,
                unit_id: unit.id,
                date: dateStr,
                shift_code: shiftCode,
              },
            });
            
            if (!availability) {
              availability = availabilityRepo.create({
                worker_id: worker.id,
                unit_id: unit.id,
                date: dateStr,
                shift_code: shiftCode,
                type: AvailabilityType.AVAILABLE,
                source: 'JSON_SEED',
                reason: null,
                attributes: {},
              });
              await availabilityRepo.save(availability);
              availabilityCount++;
            }
          } else if (isAvailable === 0) {
            skippedCount++; // Count unavailable days (we don't store these)
          }
        }
      }
    }
    
    console.log(`   ✓ ${availabilityCount} availability records created`);
    console.log(`   ℹ ${skippedCount} unavailable slots (not stored)`);

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
    console.log(`   Workers:         ${workers.length} nurses`);
    console.log(`   Shifts:          ${jsonData.shifts.join(', ')}`);
    console.log(`   Availability:    ${availabilityCount} records`);
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
