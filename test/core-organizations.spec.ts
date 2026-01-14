import { OrganizationsController } from '../src/core/organizations/organizations.controller';
import { OrganizationsService } from '../src/core/organizations/organizations.service';

describe('OrganizationsController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new OrganizationsController(svc);
    expect(controller).toBeDefined();
  });
});

describe('OrganizationsService', () => {
  it('should be defined', () => {
    const service = new OrganizationsService({} as any);
    expect(service).toBeDefined();
  });
});
