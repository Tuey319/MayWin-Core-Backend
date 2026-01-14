import { UnitsController } from '../src/core/units/units.controller';
import { UnitsService } from '../src/core/units/units.service';

describe('UnitsController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new UnitsController(svc);
    expect(controller).toBeDefined();
  });
});

describe('UnitsService', () => {
  it('should be defined', () => {
    const service = new UnitsService({} as any);
    expect(service).toBeDefined();
  });
});
