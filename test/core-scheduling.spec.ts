import { ScheduleAssignmentsController } from '../src/core/scheduling/schedule-assignments.controller';
import { SchedulesController } from '../src/core/scheduling/schedules.controller';
import { SchedulesService } from '../src/core/scheduling/schedules.service';

describe('ScheduleAssignmentsController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new ScheduleAssignmentsController(svc);
    expect(controller).toBeDefined();
  });
});

describe('SchedulesController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new SchedulesController(svc);
    expect(controller).toBeDefined();
  });
});

describe('SchedulesService', () => {
  it('should be defined', () => {
    const service = new SchedulesService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(service).toBeDefined();
  });
});
