import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../src/core/auth/auth.controller';
import { AuthService } from '../src/core/auth/auth.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<any> = {}) {
  return {
    id: '42',
    email: 'user@example.com',
    password_hash: '$2b$10$hashedpassword',
    full_name: 'John Doe',
    organization_id: '1',
    is_active: true,
    ...overrides,
  };
}

function makeOtp(overrides: Partial<any> = {}) {
  return {
    id: 'otp1',
    user_id: '42',
    otp_code: '123456',
    expires_at: new Date(Date.now() + 10 * 60 * 1000),
    used_at: null,
    created_at: new Date(),
    ...overrides,
  };
}

function makeDeps() {
  return {
    userRepo: { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn() },
    unitMembershipRepo: { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn() },
    userRoleRepo: { find: jest.fn() },
    roleRepo: { find: jest.fn() },
    otpRepo: { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() },
    jwtService: { sign: jest.fn().mockReturnValue('jwt-token'), verify: jest.fn() },
    mailService: { sendOtp: jest.fn().mockResolvedValue(undefined), sendWelcome: jest.fn().mockResolvedValue(undefined) },
  };
}

function makeSvc(overrides: Partial<ReturnType<typeof makeDeps>> = {}) {
  const d = { ...makeDeps(), ...overrides };
  const svc = new AuthService(
    d.userRepo as any,
    d.unitMembershipRepo as any,
    d.userRoleRepo as any,
    d.roleRepo as any,
    d.otpRepo as any,
    d.jwtService as any,
    d.mailService as any,
  );
  return { svc, ...d };
}

// ── Controller smoke test ──────────────────────────────────────────────────────

describe('AuthController', () => {
  it('should be defined', () => {
    const controller = new AuthController({} as any);
    expect(controller).toBeDefined();
  });
});

// ── AuthService ────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  it('should be defined', () => {
    const svc = new AuthService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    expect(svc).toBeDefined();
  });

  // ── POST /auth/login ─────────────────────────────────────────────────────────

  describe('login()', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      const { svc, userRepo } = makeSvc();
      userRepo.findOne.mockResolvedValue(null);

      await expect(svc.login('unknown@example.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      // Use a real bcrypt hash that will NOT match 'wrongpassword'
      const user = makeUser({ password_hash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' });
      const { svc, userRepo } = makeSvc();
      userRepo.findOne.mockResolvedValue(user);

      await expect(svc.login('user@example.com', 'wrongpassword')).rejects.toThrow(UnauthorizedException);
    });

    it('returns requires2FA + otpToken on valid credentials (2FA enabled)', async () => {
      const origEnv = process.env.AUTH_DISABLE_OTP;
      process.env.AUTH_DISABLE_OTP = 'false';
      process.env.AUTH_ALLOW_OTP_LOG_FALLBACK = 'true';

      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('correctpassword', 10);
      const user = makeUser({ password_hash: hash });
      const { svc, userRepo, otpRepo, jwtService } = makeSvc();
      userRepo.findOne.mockResolvedValue(user);
      otpRepo.delete.mockResolvedValue(undefined);
      otpRepo.create.mockReturnValue({});
      otpRepo.save.mockResolvedValue({});
      jwtService.sign.mockReturnValue('pending-otp-token');

      const result = await svc.login('user@example.com', 'correctpassword');

      expect(result).toHaveProperty('requires2FA', true);
      expect(result).toHaveProperty('otpToken', 'pending-otp-token');

      process.env.AUTH_DISABLE_OTP = origEnv;
    });

    it('returns accessToken directly when AUTH_DISABLE_OTP=true', async () => {
      const origEnv = process.env.AUTH_DISABLE_OTP;
      process.env.AUTH_DISABLE_OTP = 'true';

      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('correctpassword', 10);
      const user = makeUser({ password_hash: hash });
      const { svc, userRepo, unitMembershipRepo, userRoleRepo, roleRepo, jwtService } = makeSvc();
      userRepo.findOne.mockResolvedValue(user);
      unitMembershipRepo.find.mockResolvedValue([]);
      userRoleRepo.find.mockResolvedValue([]);
      roleRepo.find.mockResolvedValue([]);
      jwtService.sign.mockReturnValue('access-token-direct');

      const result = await svc.login('user@example.com', 'correctpassword');

      expect(result).toHaveProperty('accessToken', 'access-token-direct');
      expect(result).not.toHaveProperty('requires2FA');

      process.env.AUTH_DISABLE_OTP = origEnv;
    });
  });

  // ── POST /auth/verify-otp ────────────────────────────────────────────────────

  describe('verifyOtp()', () => {
    it('throws UnauthorizedException for invalid/expired otpToken', async () => {
      const { svc, jwtService } = makeSvc();
      jwtService.verify.mockImplementation(() => { throw new Error('expired'); });

      await expect(svc.verifyOtp('bad-token', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong token type', async () => {
      const { svc, jwtService } = makeSvc();
      jwtService.verify.mockReturnValue({ type: 'FULL_JWT', sub: '42' });

      await expect(svc.verifyOtp('token', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when no pending OTP record exists', async () => {
      const { svc, jwtService, otpRepo } = makeSvc();
      jwtService.verify.mockReturnValue({ type: 'OTP_PENDING', sub: '42' });
      otpRepo.findOne.mockResolvedValue(null);

      await expect(svc.verifyOtp('pending-token', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for expired OTP code', async () => {
      const { svc, jwtService, otpRepo } = makeSvc();
      jwtService.verify.mockReturnValue({ type: 'OTP_PENDING', sub: '42' });
      otpRepo.findOne.mockResolvedValue(makeOtp({ expires_at: new Date(Date.now() - 1000) }));

      await expect(svc.verifyOtp('pending-token', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for incorrect OTP code', async () => {
      const { svc, jwtService, otpRepo } = makeSvc();
      jwtService.verify.mockReturnValue({ type: 'OTP_PENDING', sub: '42' });
      otpRepo.findOne.mockResolvedValue(makeOtp({ otp_code: '999999' }));

      await expect(svc.verifyOtp('pending-token', '111111')).rejects.toThrow(UnauthorizedException);
    });

    it('returns accessToken + user on correct OTP', async () => {
      const user = makeUser();
      const otp = makeOtp();
      const { svc, jwtService, otpRepo, userRepo, unitMembershipRepo, userRoleRepo, roleRepo } = makeSvc();
      jwtService.verify.mockReturnValue({ type: 'OTP_PENDING', sub: '42' });
      otpRepo.findOne.mockResolvedValue(otp);
      otpRepo.save.mockResolvedValue(otp);
      userRepo.findOne.mockResolvedValue(user);
      unitMembershipRepo.find.mockResolvedValue([]);
      userRoleRepo.find.mockResolvedValue([]);
      roleRepo.find.mockResolvedValue([]);
      jwtService.sign.mockReturnValue('real-access-token');

      const result = await svc.verifyOtp('pending-token', '123456');

      expect(result).toHaveProperty('accessToken', 'real-access-token');
      expect(result.user).toMatchObject({ id: '42', email: 'user@example.com' });
    });
  });

  // ── POST /auth/signup ────────────────────────────────────────────────────────

  describe('signup()', () => {
    it('throws BadRequestException when email already exists', async () => {
      const { svc, userRepo } = makeSvc();
      userRepo.findOne.mockResolvedValue(makeUser());

      await expect(svc.signup({
        email: 'user@example.com',
        password: 'pass123',
        fullName: 'Jane',
        organizationId: '1',
      } as any)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when organizationId is missing', async () => {
      const { svc, userRepo } = makeSvc();
      userRepo.findOne.mockResolvedValue(null);

      await expect(svc.signup({
        email: 'new@example.com',
        password: 'pass123',
        fullName: 'Jane',
      } as any)).rejects.toThrow(BadRequestException);
    });

    it('creates user and returns accessToken on success', async () => {
      const savedUser = makeUser({ id: '99', email: 'new@example.com' });
      const { svc, userRepo, unitMembershipRepo, userRoleRepo, roleRepo, jwtService } = makeSvc();
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue(savedUser);
      userRepo.save.mockResolvedValue(savedUser);
      unitMembershipRepo.find.mockResolvedValue([]);
      unitMembershipRepo.findOne.mockResolvedValue(null);
      unitMembershipRepo.create.mockReturnValue({});
      unitMembershipRepo.save.mockResolvedValue({});
      userRoleRepo.find.mockResolvedValue([]);
      roleRepo.find.mockResolvedValue([]);
      jwtService.sign.mockReturnValue('signup-token');

      const result = await svc.signup({
        email: 'new@example.com',
        password: 'pass123',
        fullName: 'Jane',
        organizationId: '1',
      } as any);

      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe('new@example.com');
    });

    it('assigns unit membership when unitId is provided', async () => {
      const savedUser = makeUser({ id: '99' });
      const { svc, userRepo, unitMembershipRepo, userRoleRepo, roleRepo, jwtService } = makeSvc();
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue(savedUser);
      userRepo.save.mockResolvedValue(savedUser);
      unitMembershipRepo.find.mockResolvedValue([]);
      unitMembershipRepo.findOne.mockResolvedValue(null);
      unitMembershipRepo.create.mockReturnValue({});
      unitMembershipRepo.save.mockResolvedValue({});
      userRoleRepo.find.mockResolvedValue([]);
      roleRepo.find.mockResolvedValue([]);
      jwtService.sign.mockReturnValue('token');

      await svc.signup({
        email: 'newunit@example.com',
        password: 'pass123',
        fullName: 'Jane',
        organizationId: '1',
        unitId: '5',
      } as any);

      expect(unitMembershipRepo.save).toHaveBeenCalled();
    });
  });

  // ── POST /auth/logout ────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('always returns ok:true', async () => {
      const { svc } = makeSvc();
      const result = await svc.logout({}, {});
      expect(result).toEqual({ ok: true });
    });
  });
});
