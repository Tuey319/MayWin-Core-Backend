import { SitesController } from '../src/core/sites/sites.controller';
import { SitesService } from '../src/core/sites/sites.service';

describe('SitesController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new SitesController(svc);
    expect(controller).toBeDefined();
  });
});

describe('SitesService', () => {
  it('should be defined', () => {
    const service = new SitesService({} as any);
    expect(service).toBeDefined();
  });
});
