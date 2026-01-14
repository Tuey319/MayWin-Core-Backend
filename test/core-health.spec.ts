import { HealthController } from '../src/core/health/health.controller';

describe('HealthController', () => {
  it('should be defined', () => {
    const controller = new HealthController();
    expect(controller).toBeDefined();
  });

  it('health() should return ok status', () => {
    const controller = new HealthController();
    const res = controller.health();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('core-backend');
  });
});
