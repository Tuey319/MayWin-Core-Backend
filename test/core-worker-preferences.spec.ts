import { WorkerPreferencesController } from '../src/core/worker-preferences/worker-preferences.controller';
import { WorkerPreferencesService } from '../src/core/worker-preferences/worker-preferences.service';

describe('WorkerPreferencesController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new WorkerPreferencesController(svc);
    expect(controller).toBeDefined();
  });
});

describe('WorkerPreferencesService', () => {
  it('should be defined', () => {
    const service = new WorkerPreferencesService({} as any);
    expect(service).toBeDefined();
  });
});
