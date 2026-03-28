import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { WorkerMessagesController } from '../src/core/messages/worker-messages.controller';
import { WorkerMessagesService } from '../src/core/messages/worker-messages.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<any> = {}) {
  return {
    id: 'msg1',
    worker_id: '5',
    organization_id: '1',
    unit_id: '20',
    sender_user_id: 'u1',
    sender_worker_id: null,
    direction: 'INBOUND',
    status: 'SENT',
    subject: null,
    body: 'Hello',
    job_id: null,
    schedule_id: null,
    shift_date: null,
    shift_code: null,
    attributes: {},
    ...overrides,
  };
}

function makeWorker(overrides: Partial<any> = {}) {
  return {
    id: '99',
    organization_id: '1',
    full_name: 'Auto-generated Worker',
    is_active: true,
    primary_unit_id: null,
    ...overrides,
  };
}

function makeSvc(msgRepoOverrides: Partial<any> = {}, workerRepoOverrides: Partial<any> = {}) {
  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    ...msgRepoOverrides,
  };
  const workerRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    ...workerRepoOverrides,
  };
  const svc = new WorkerMessagesService(repo as any, workerRepo as any);
  return { svc, repo, workerRepo };
}

// ── Controller smoke test ──────────────────────────────────────────────────────

describe('WorkerMessagesController', () => {
  it('should be defined', () => {
    const controller = new WorkerMessagesController({} as any);
    expect(controller).toBeDefined();
  });
});

// ── WorkerMessagesService ──────────────────────────────────────────────────────

describe('WorkerMessagesService', () => {
  it('should be defined', () => {
    const svc = new WorkerMessagesService({} as any, {} as any);
    expect(svc).toBeDefined();
  });

  // ── POST /workers/:workerId/messages ──────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns a message with senderUserId', async () => {
      const message = makeMessage();
      const { svc, repo } = makeSvc({
        create: jest.fn().mockReturnValue(message),
        save: jest.fn().mockResolvedValue(message),
      });

      const dto = {
        senderUserId: 'u1',
        body: 'Hello',
        organizationId: '1',
        direction: 'INBOUND',
        status: 'SENT',
      } as any;
      const user = { organizationId: 1 };
      const result = await svc.create('5', dto, user);

      expect(repo.save).toHaveBeenCalled();
      expect(result.body).toBe('Hello');
    });

    it('creates a message with senderWorkerId', async () => {
      const message = makeMessage({ sender_user_id: null, sender_worker_id: 'w1' });
      const { svc, repo } = makeSvc({
        create: jest.fn().mockReturnValue(message),
        save: jest.fn().mockResolvedValue(message),
      });

      const dto = {
        senderWorkerId: 'w1',
        body: 'Hey manager',
        organizationId: '1',
        direction: 'OUTBOUND',
      } as any;
      const result = await svc.create('5', dto, {});

      expect(repo.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when neither senderUserId nor senderWorkerId provided', async () => {
      const { svc } = makeSvc();

      const dto = { body: 'Hello', organizationId: '1' } as any;
      await expect(svc.create('5', dto, {})).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when organizationId cannot be resolved', async () => {
      const messageWithoutOrg = makeMessage({ organization_id: '' });
      const { svc, repo } = makeSvc({
        create: jest.fn().mockReturnValue(messageWithoutOrg),
        save: jest.fn(),
      });

      const dto = { senderUserId: 'u1', body: 'Hello' } as any;
      await expect(svc.create('5', dto, {})).rejects.toThrow(BadRequestException);
    });
  });

  // ── POST /chat ────────────────────────────────────────────────────────────────

  describe('createChatAnonymous()', () => {
    it('throws ForbiddenException when user context is missing', async () => {
      const { svc } = makeSvc();

      await expect(
        svc.createChatAnonymous({ body: 'Hello' } as any, null),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user id is missing from auth context', async () => {
      const { svc } = makeSvc();

      await expect(
        svc.createChatAnonymous({ body: 'Hello' } as any, { organizationId: 1 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when organization id is missing from auth context', async () => {
      const { svc } = makeSvc();

      await expect(
        svc.createChatAnonymous({ body: 'Hello' } as any, { id: 'u1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
