import { AvailabilityController } from '../src/core/availability/availability.controller';
import { AvailabilityService } from '../src/core/availability/availability.service';

describe('AvailabilityController', () => {
  it('should be defined', () => {
    const service = {} as any;
    const controller = new AvailabilityController(service);
    expect(controller).toBeDefined();
  });
});

describe('AvailabilityService', () => {
  it('should be defined', () => {
    const service = new AvailabilityService({} as any);
    expect(service).toBeDefined();
  });
});
