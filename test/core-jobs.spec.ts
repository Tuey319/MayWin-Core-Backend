import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JobsController } from '../src/core/jobs/jobs.controller';
import { JobsService } from '../src/core/jobs/jobs.service';
import { JobsRunnerService } from '../src/core/jobs/jobs-runner.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSchedule(overrides: Partial<any> = {}) {
  return {
    id: 'sched1',
    organization_id: '1',
    unit_id: '20',
    created_by: '42',
    job_id: null,
    attributes: {},
    ...overrides,
  };
}

function makeJob(overrides: Partial<any> = {}) {
  return {
    id: 'job1',
    organization_id: '1',
    unit_id: '20',
    status: 'REQUESTED',
    start_date: '2026-04-01',
    end_date: '2026-04-30',
    error_code: null,
    error_message: null,
    idempotency_key: null,
    attributes: { scheduleId: 'sched1' },
    created_at: new Date('2026-03-01'),
    updated_at: new Date('2026-03-01'),
    ...overrides,
  };
}

function makeArtifact(overrides: Partial<any> = {}) {
  return {
    id: 'art1',
    job_id: 'job1',
    type: 'NORMALIZED_INPUT',
    storage_provider: 'LOCAL',
    bucket: null,
    object_key: null,
    content_type: 'application/json',
    metadata: {},
    created_at: new Date('2026-03-01'),
    ...overrides,
  };
}

function makeSvc(overrides: Partial<any> = {}) {
  const schedulesRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    ...overrides.schedulesRepo,
  };
  const assignmentsRepo = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    delete: jest.fn(),
    ...overrides.assignmentsRepo,
  };
  const jobsRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    ...overrides.jobsRepo,
  };
  const artifactsRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    ...overrides.artifactsRepo,
  };
  const workersRepo = { find: jest.fn().mockResolvedValue([]), ...overrides.workersRepo };
  const runner = { enqueue: jest.fn(), ...overrides.runner };
  const s3Artifacts = { getText: jest.fn(), putText: jest.fn(), ...overrides.s3Artifacts };

  const svc = new JobsService(
    schedulesRepo as any,
    assignmentsRepo as any,
    jobsRepo as any,
    artifactsRepo as any,
    workersRepo as any,
    runner as any,
    s3Artifacts as any,
  );
  return { svc, schedulesRepo, assignmentsRepo, jobsRepo, artifactsRepo, workersRepo, runner };
}

// ── Controller smoke tests ─────────────────────────────────────────────────────

describe('JobsController', () => {
  it('should be defined', () => {
    const controller = new JobsController({} as any);
    expect(controller).toBeDefined();
  });
});

describe('JobsRunnerService', () => {
  it('should be defined', () => {
    const svc = new JobsRunnerService({} as any, {} as any, {} as any, {} as any, {} as any);
    expect(svc).toBeDefined();
  });
});

// ── JobsService ────────────────────────────────────────────────────────────────

describe('JobsService', () => {
  it('should be defined', () => {
    const svc = new JobsService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    expect(svc).toBeDefined();
  });

  // ── POST /schedules/:scheduleId/jobs ──────────────────────────────────────────

  describe('createJob()', () => {
    it('creates and returns a job for a valid schedule', async () => {
      const schedule = makeSchedule();
      const job = makeJob();
      const { svc, schedulesRepo, jobsRepo } = makeSvc();
      schedulesRepo.findOne.mockResolvedValue(schedule);
      schedulesRepo.save.mockResolvedValue(schedule);
      jobsRepo.findOne.mockResolvedValue(null);
      jobsRepo.create.mockReturnValue(job);
      jobsRepo.save.mockResolvedValue(job);

      const dto = { startDate: '2026-04-01', endDate: '2026-04-30' } as any;
      const result = await svc.createJob('sched1', dto, null);

      expect(jobsRepo.save).toHaveBeenCalled();
      expect(result.job.id).toBe('job1');
      expect(result.job.scheduleId).toBe('sched1');
      expect(result.job.state).toBe('REQUESTED');
    });

    it('throws NotFoundException when schedule does not exist', async () => {
      const { svc, schedulesRepo } = makeSvc();
      schedulesRepo.findOne.mockResolvedValue(null);

      await expect(
        svc.createJob('non-existent', { startDate: '2026-04-01', endDate: '2026-04-30' } as any, null),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when schedule has no unit_id', async () => {
      const schedule = makeSchedule({ unit_id: null });
      const { svc, schedulesRepo } = makeSvc();
      schedulesRepo.findOne.mockResolvedValue(schedule);

      await expect(
        svc.createJob('sched1', { startDate: '2026-04-01', endDate: '2026-04-30' } as any, null),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns existing job when idempotency key matches', async () => {
      const schedule = makeSchedule();
      const existingJob = makeJob({ id: 'existing-job' });
      const { svc, schedulesRepo, jobsRepo } = makeSvc();
      schedulesRepo.findOne.mockResolvedValue(schedule);
      jobsRepo.findOne.mockResolvedValue(existingJob);

      const dto = { startDate: '2026-04-01', endDate: '2026-04-30' } as any;
      const result = await svc.createJob('sched1', dto, 'idem-key-123');

      expect(result.job.id).toBe('existing-job');
      expect(jobsRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── GET /jobs/:jobId ──────────────────────────────────────────────────────────

  describe('getJob()', () => {
    it('returns job details', async () => {
      const job = makeJob();
      const { svc, jobsRepo } = makeSvc();
      jobsRepo.findOne.mockResolvedValue(job);

      const result = await svc.getJob('job1');

      expect(result.job.id).toBe('job1');
      expect(result.job.state).toBe('REQUESTED');
      expect(result.job.scheduleId).toBe('sched1');
    });

    it('throws NotFoundException when job does not exist', async () => {
      const { svc, jobsRepo } = makeSvc();
      jobsRepo.findOne.mockResolvedValue(null);

      await expect(svc.getJob('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── GET /jobs/:jobId/artifacts ────────────────────────────────────────────────

  describe('listArtifacts()', () => {
    it('returns artifacts for a job', async () => {
      const job = makeJob();
      const artifacts = [makeArtifact(), makeArtifact({ id: 'art2', type: 'SOLVER_RESULT' })];
      const { svc, jobsRepo, artifactsRepo } = makeSvc();
      jobsRepo.findOne.mockResolvedValue(job);
      artifactsRepo.find.mockResolvedValue(artifacts);

      const result = await svc.listArtifacts('job1');

      expect(result.artifacts).toHaveLength(2);
      expect(result.artifacts[0].id).toBe('art1');
      expect(result.artifacts[0].type).toBe('NORMALIZED_INPUT');
    });

    it('returns empty artifacts array when none exist', async () => {
      const job = makeJob();
      const { svc, jobsRepo, artifactsRepo } = makeSvc();
      jobsRepo.findOne.mockResolvedValue(job);
      artifactsRepo.find.mockResolvedValue([]);

      const result = await svc.listArtifacts('job1');

      expect(result.artifacts).toHaveLength(0);
    });

    it('throws NotFoundException when job does not exist', async () => {
      const { svc, jobsRepo } = makeSvc();
      jobsRepo.findOne.mockResolvedValue(null);

      await expect(svc.listArtifacts('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
