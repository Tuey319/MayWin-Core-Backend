import { Test, TestingModule } from '@nestjs/testing';
import { SchedulesController } from '../src/core/scheduling/schedules.controller';
import { SchedulesService } from '../src/core/scheduling/schedules.service';
import { JobsController } from '../src/core/jobs/jobs.controller';
import { JobsService } from '../src/core/jobs/jobs.service';
import { JobsRunnerService } from '../src/core/jobs/jobs-runner.service';
import { WorkersController } from '../src/core/workers/workers.controller';
import { WorkersService } from '../src/core/workers/workers.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Schedule } from '../src/database/entities/scheduling/schedule.entity';
import { ScheduleAssignment } from '../src/database/entities/scheduling/schedule-assignment.entity';
import { ShiftTemplate } from '../src/database/entities/scheduling/shift-template.entity';
import { Unit } from '../src/database/entities/core/unit.entity';
import { User } from '../src/database/entities/users/user.entity';
import { Worker } from '../src/database/entities/workers/worker.entity';
import { WorkerPreference } from '../src/database/entities/workers/worker-preferences.entity';
import { ScheduleJob } from '../src/database/entities/orchestration/schedule-job.entity';
import { ScheduleArtifact } from '../src/database/entities/orchestration/schedule-artifact.entity';
import { BadRequestException } from '@nestjs/common';

describe('Compatibility Routes', () => {
  describe('SchedulesController - GET /schedule alias', () => {
    let controller: SchedulesController;
    let service: SchedulesService;
    let mockRepos: any;

    beforeEach(async () => {
      mockRepos = {
        schedulesRepo: {
          manager: { query: jest.fn() },
          findOne: jest.fn(),
          find: jest.fn(),
        },
        assignmentsRepo: {
          find: jest.fn(),
        },
        shiftTemplatesRepo: {
          find: jest.fn(),
        },
        unitsRepo: {
          findOne: jest.fn(),
        },
        usersRepo: {
          exist: jest.fn(),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [SchedulesController],
        providers: [
          SchedulesService,
          {
            provide: getRepositoryToken(Schedule),
            useValue: mockRepos.schedulesRepo,
          },
          {
            provide: getRepositoryToken(ScheduleAssignment),
            useValue: mockRepos.assignmentsRepo,
          },
          {
            provide: getRepositoryToken(ShiftTemplate),
            useValue: mockRepos.shiftTemplatesRepo,
          },
          {
            provide: getRepositoryToken(Unit),
            useValue: mockRepos.unitsRepo,
          },
          {
            provide: getRepositoryToken(User),
            useValue: mockRepos.usersRepo,
          },
        ],
      }).compile();

      controller = module.get<SchedulesController>(SchedulesController);
      service = module.get<SchedulesService>(SchedulesService);
    });

    it('should return schedule assignments via GET /schedule?unitId=2', async () => {
      const mockSchedule = {
        id: 'sched-1',
        unit_id: '2',
        name: 'Test Schedule',
        start_date: '2025-03-01',
        end_date: '2025-03-31',
        status: 'DRAFT',
        organization_id: '1',
        job_id: null,
        constraint_profile_id: null,
        last_solver_run_id: null,
        attributes: {},
        current_run_id: null,
        created_at: new Date(),
        published_at: null,
        published_by: null,
      };

      const mockAssignments = [
        {
          id: 'assign-1',
          worker_id: '42',
          date: '2025-03-01',
          shift_code: 'M',
          source: 'SOLVER',
          attributes: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockRepos.schedulesRepo.manager.query.mockResolvedValue([]);
      mockRepos.schedulesRepo.findOne.mockResolvedValue(mockSchedule);
      mockRepos.assignmentsRepo.find.mockResolvedValue(mockAssignments);
      mockRepos.shiftTemplatesRepo.find.mockResolvedValue([]);

      const result = await controller.getCurrentCompat('2');

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('assignments');
      expect(result.result.assignments).toHaveLength(1);
      expect(result.result.assignments[0].workerId).toBe('42');
      expect(result.result.assignments[0].shiftCode).toBe('M');
    });

    it('should throw BadRequestException if unitId missing', async () => {
      await expect(controller.getCurrentCompat(undefined)).rejects.toThrow(BadRequestException);
    });
  });

  describe('JobsController - GET /schedule-jobs/:jobId alias', () => {
    let controller: JobsController;
    let service: JobsService;
    let mockRepos: any;

    beforeEach(async () => {
      mockRepos = {
        schedulesRepo: {
          findOne: jest.fn(),
        },
        assignmentsRepo: {
          find: jest.fn(),
        },
        jobsRepo: {
          findOne: jest.fn(),
        },
        artifactsRepo: {
          find: jest.fn(),
        },
      };

      const mockJobsRunner = {
        enqueue: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [JobsController],
        providers: [
          JobsService,
          {
            provide: getRepositoryToken(Schedule),
            useValue: mockRepos.schedulesRepo,
          },
          {
            provide: getRepositoryToken(ScheduleAssignment),
            useValue: mockRepos.assignmentsRepo,
          },
          {
            provide: getRepositoryToken(ScheduleJob),
            useValue: mockRepos.jobsRepo,
          },
          {
            provide: getRepositoryToken(ScheduleArtifact),
            useValue: mockRepos.artifactsRepo,
          },
          {
            provide: JobsRunnerService,
            useValue: mockJobsRunner,
          },
        ],
      }).compile();

      controller = module.get<JobsController>(JobsController);
    });

    it('should return job status via GET /schedule-jobs/:jobId', async () => {
      const mockJob = {
        id: 'job-uuid-123',
        status: 'COMPLETED',
        attributes: { scheduleId: 'sched-1' },
        created_at: new Date(),
        updated_at: new Date(),
        error_code: null,
        error_message: null,
      };

      mockRepos.jobsRepo.findOne.mockResolvedValue(mockJob);

      const result = await controller.getScheduleJob('job-uuid-123');

      expect(result.job).toBeDefined();
      expect(result.job.id).toBe('job-uuid-123');
      expect(result.job.state).toBe('COMPLETED');
    });

    it('should also work via GET /jobs/:jobId', async () => {
      const mockJob = {
        id: 'job-uuid-456',
        status: 'RUNNING',
        attributes: { scheduleId: 'sched-2' },
        created_at: new Date(),
        updated_at: new Date(),
        error_code: null,
        error_message: null,
      };

      mockRepos.jobsRepo.findOne.mockResolvedValue(mockJob);

      const result = await controller.getJob('job-uuid-456');

      expect(result.job).toBeDefined();
      expect(result.job.id).toBe('job-uuid-456');
      expect(result.job.state).toBe('RUNNING');
    });
  });

  describe('WorkersController - GET /nurses/export alias', () => {
    let controller: WorkersController;
    let service: WorkersService;
    let mockRepos: any;

    beforeEach(async () => {
      mockRepos = {
        workersRepo: {
          find: jest.fn(),
        },
        prefsRepo: {
          findOne: jest.fn(),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [WorkersController],
        providers: [
          WorkersService,
          {
            provide: getRepositoryToken(Worker),
            useValue: mockRepos.workersRepo,
          },
          {
            provide: getRepositoryToken(WorkerPreference),
            useValue: mockRepos.prefsRepo,
          },
        ],
      }).compile();

      controller = module.get<WorkersController>(WorkersController);
    });

    it('should export nurses list via GET /nurses/export?unitId=2', async () => {
      const mockWorkers = [
        {
          id: '42',
          full_name: 'Nurse A',
          worker_code: 'N001',
          employment_type: 'FULL_TIME',
          line_id: 'line_a',
          attributes: { email: 'nursea@test.com' },
        },
      ];

      mockRepos.workersRepo.find.mockResolvedValue(mockWorkers);

      const result = await controller.exportNurses('2');

      expect(result).toHaveProperty('nurses');
      expect(result.nurses).toHaveLength(1);
      expect(result.nurses[0]).toHaveProperty('id');
      expect(result.nurses[0]).toHaveProperty('name');
      expect(result.nurses[0]).toHaveProperty('employment_type');
      expect(result.nurses[0]).toHaveProperty('unit');
      expect(result.nurses[0].unit).toBe('2');
    });

    it('should default to unitId=2 if not provided', async () => {
      const mockWorkers: any[] = [];
      mockRepos.workersRepo.find.mockResolvedValue(mockWorkers);

      const result = await controller.exportNurses(undefined);

      expect(result.nurses).toBeDefined();
      expect(Array.isArray(result.nurses)).toBe(true);
    });
  });
});
