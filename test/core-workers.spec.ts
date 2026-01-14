import { WorkersController } from '../src/core/workers/workers.controller';
import { WorkersService } from '../src/core/workers/workers.service';

describe('WorkersController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new WorkersController(svc);
    expect(controller).toBeDefined();
  });
});

describe('WorkersService', () => {
  it('should be defined', () => {
    const service = new WorkersService({} as any, {} as any);
    expect(service).toBeDefined();
  });
});
