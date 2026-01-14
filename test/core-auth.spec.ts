import { AuthController } from '../src/core/auth/auth.controller';
import { AuthService } from '../src/core/auth/auth.service';

describe('AuthController', () => {
  it('should be defined', () => {
    const service = {} as any;
    const controller = new AuthController(service);
    expect(controller).toBeDefined();
  });
});

describe('AuthService', () => {
  it('should be defined', () => {
    const service = new AuthService({} as any, {} as any, {} as any, {} as any);
    expect(service).toBeDefined();
  });
});
