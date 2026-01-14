import { RolesController } from '../src/core/roles/roles.controller';
import { RolesService } from '../src/core/roles/roles.service';

describe('RolesController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new RolesController(svc);
    expect(controller).toBeDefined();
  });
});

describe('RolesService', () => {
  it('should be defined', () => {
    const service = new RolesService({} as any);
    expect(service).toBeDefined();
  });
});
