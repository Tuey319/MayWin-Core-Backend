import { JobsController } from '../src/core/jobs/jobs.controller';
import { JobsService } from '../src/core/jobs/jobs.service';
import { JobsRunnerService } from '../src/core/jobs/jobs-runner.service';

describe('JobsController', () => {
  it('should be defined', () => {
    const service = {} as any;
    const controller = new JobsController(service);
    expect(controller).toBeDefined();
  });
});

describe('JobsService', () => {
  it('should be defined', () => {
    const service = new JobsService({} as any, {} as any, {} as any, {} as any, {} as any);
    expect(service).toBeDefined();
  });
});

describe('JobsRunnerService', () => {
  it('should be defined', () => {
    const service = new JobsRunnerService({} as any, {} as any, {} as any, {} as any);
    expect(service).toBeDefined();
  });
});
