import { UnitConfigController } from '../src/core/unit-config/unit-config.controller';
import { UnitConfigService } from '../src/core/unit-config/unit-config.service';
import { ConstraintProfilesController } from '../src/core/unit-config/constraint-profiles/constraint-profiles.controller';
import { ConstraintProfilesService } from '../src/core/unit-config/constraint-profiles/constraint-profiles.service';
import { CoverageRulesController } from '../src/core/unit-config/coverage-rules/coverage-rules.controller';
import { CoverageRulesService } from '../src/core/unit-config/coverage-rules/coverage-rules.service';
import { ShiftTemplatesController } from '../src/core/unit-config/shift-templates/shift-templates.controller';
import { ShiftTemplatesService } from '../src/core/unit-config/shift-templates/shift-templates.service';

describe('UnitConfigController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new UnitConfigController(svc);
    expect(controller).toBeDefined();
  });
});

describe('UnitConfigService', () => {
  it('should be defined', () => {
    const service = new UnitConfigService({} as any, {} as any, {} as any);
    expect(service).toBeDefined();
  });
});

describe('ConstraintProfilesController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new ConstraintProfilesController(svc);
    expect(controller).toBeDefined();
  });
});

describe('ConstraintProfilesService', () => {
  it('should be defined', () => {
    const service = new ConstraintProfilesService({} as any);
    expect(service).toBeDefined();
  });
});

describe('CoverageRulesController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new CoverageRulesController(svc);
    expect(controller).toBeDefined();
  });
});

describe('CoverageRulesService', () => {
  it('should be defined', () => {
    const service = new CoverageRulesService({} as any);
    expect(service).toBeDefined();
  });
});

describe('ShiftTemplatesController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new ShiftTemplatesController(svc);
    expect(controller).toBeDefined();
  });
});

describe('ShiftTemplatesService', () => {
  it('should be defined', () => {
    const service = new ShiftTemplatesService({} as any);
    expect(service).toBeDefined();
  });
});
