import { OrchestratorController } from '../src/core/orchestrator/orchestrator.controller';

describe('OrchestratorController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new OrchestratorController(svc);
    expect(controller).toBeDefined();
  });
});
