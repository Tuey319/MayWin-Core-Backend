import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StaffController } from '../src/core/staff/staff.controller';
import { StaffService } from '../src/core/staff/staff.service';
import { AuditLogsService } from '../src/core/audit-logs/audit-logs.service';
import { MailService } from '../src/core/mail/mail.service';
import { Worker, EmploymentType } from '../src/database/entities/workers/worker.entity';
import { User } from '../src/database/entities/users/user.entity';
import { UnitMembership } from '../src/database/entities/users/unit-membership.entity';
import { LineLinkToken } from '../src/database/entities/workers/line-link-token.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('StaffController & StaffService', () => {
  let controller: StaffController;
  let service: StaffService;
  let mockWorkersRepo: any;
  let mockUsersRepo: any;
  let mockMembershipRepo: any;
  let mockLineLinkTokenRepo: any;
  let mockAuditLogsService: any;
  let mockMailService: any;

  beforeEach(async () => {
    mockWorkersRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    mockAuditLogsService = {
      append: jest.fn().mockResolvedValue({}),
    };

    mockUsersRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockMembershipRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockLineLinkTokenRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockMailService = {
      sendWelcome: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffController],
      providers: [
        StaffService,
        {
          provide: getRepositoryToken(Worker),
          useValue: mockWorkersRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepo,
        },
        {
          provide: getRepositoryToken(UnitMembership),
          useValue: mockMembershipRepo,
        },
        {
          provide: getRepositoryToken(LineLinkToken),
          useValue: mockLineLinkTokenRepo,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    controller = module.get<StaffController>(StaffController);
    service = module.get<StaffService>(StaffService);
  });

  describe('list()', () => {
    it('should return all staff for organization', async () => {
      const mockWorkers: Partial<Worker>[] = [
        {
          id: '1',
          full_name: 'nurse one',
          worker_code: 'EMP001',
          line_id: 'line_001',
          is_active: true,
          attributes: { position: 'nurse', email: 'nurse1@test.com' },
        },
      ];

      mockWorkersRepo.find.mockResolvedValue(mockWorkers);

      const result = await service.list(10);

      expect(result.ok).toBe(true);
      expect(result.staff).toHaveLength(1);
      expect(result.staff[0].name).toBe('nurse one');
      expect(result.staff[0].employeeId).toBe('EMP001');
      expect(mockWorkersRepo.find).toHaveBeenCalledWith({
        where: { organization_id: '10' },
        order: { id: 'ASC' },
      });
    });

    it('should return empty staff list when no workers exist', async () => {
      mockWorkersRepo.find.mockResolvedValue([]);

      const result = await service.list(10);

      expect(result.ok).toBe(true);
      expect(result.staff).toHaveLength(0);
    });
  });

  describe('getById()', () => {
    it('should return staff by id', async () => {
      const mockWorker: Partial<Worker> = {
        id: '1',
        full_name: 'nurse one',
        worker_code: 'EMP001',
        line_id: 'line_001',
        is_active: true,
        attributes: { position: 'nurse', email: 'nurse1@test.com' },
      };

      mockWorkersRepo.findOne.mockResolvedValue(mockWorker);

      const result = await service.getById('1', 10);

      expect(result.ok).toBe(true);
      expect(result.staff.name).toBe('nurse one');
      expect(mockWorkersRepo.findOne).toHaveBeenCalledWith({
        where: { id: '1' as any, organization_id: '10' as any },
      });
    });

    it('should throw NotFoundException when staff not found', async () => {
      mockWorkersRepo.findOne.mockResolvedValue(null);

      await expect(service.getById('999', 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should create new staff member', async () => {
      const dto = {
        name: 'New Nurse',
        employeeId: 'EMP099',
        lineId: 'line_099',
        position: 'nurse' as const,
        email: 'new@test.com',
        status: 'active' as const,
      };

      const savedWorker: Partial<Worker> = {
        id: '99',
        full_name: 'New Nurse',
        worker_code: 'EMP099',
        line_id: 'line_099',
        is_active: true,
        attributes: { position: 'nurse', email: 'new@test.com' },
      };

      mockWorkersRepo.findOne.mockResolvedValue(null);
      mockWorkersRepo.create.mockReturnValue(savedWorker);
      mockWorkersRepo.save.mockResolvedValue(savedWorker);
      mockUsersRepo.findOne.mockResolvedValue(null);
      mockUsersRepo.create.mockImplementation((v: any) => ({ id: '201', ...v }));
      mockUsersRepo.save.mockImplementation(async (v: any) => ({ id: '201', ...v }));
      mockMembershipRepo.findOne.mockResolvedValue(null);
      mockMembershipRepo.create.mockImplementation((v: any) => v);
      mockMembershipRepo.save.mockResolvedValue({});

      const result = await service.create(
        dto,
        { actorId: '1', actorName: 'Admin' },
        { organizationId: 10, unitId: 2 },
      );

      expect(result.ok).toBe(true);
      expect(result.staff.name).toBe('New Nurse');
      expect(mockAuditLogsService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_STAFF',
          targetType: 'staff',
        }),
      );
    });

    it('should throw BadRequestException if employeeId already exists', async () => {
      const dto = {
        name: 'Duplicate',
        employeeId: 'EMP001',
        lineId: 'line_001',
        position: 'nurse' as const,
        email: 'dup@test.com',
      };

      mockWorkersRepo.findOne.mockResolvedValue({ id: '1' });

      await expect(
        service.create(
          dto,
          { actorId: '1', actorName: 'Admin' },
          { organizationId: 10, unitId: 2 },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if required fields missing', async () => {
      const dto = {
        name: '',
        employeeId: 'EMP001',
        lineId: 'line_001',
        position: 'nurse' as const,
        email: 'test@test.com',
      };

      await expect(
        service.create(
          dto,
          { actorId: '1', actorName: 'Admin' },
          { organizationId: 10, unitId: 2 },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('patch()', () => {
    it('should update staff member', async () => {
      const existing: Partial<Worker> = {
        id: '1',
        full_name: 'Old Name',
        worker_code: 'EMP001',
        line_id: 'line_001',
        is_active: true,
        attributes: { position: 'nurse', email: 'old@test.com' },
      };

      const updated: Partial<Worker> = {
        ...existing,
        full_name: 'New Name',
        attributes: { position: 'nurse', email: 'new@test.com' },
      };

      mockWorkersRepo.findOne.mockResolvedValue(existing);
      mockWorkersRepo.save.mockResolvedValue(updated);

      const result = await service.patch(
        '1',
        { name: 'New Name', email: 'new@test.com' },
        { actorId: '1', actorName: 'Admin' },
        10,
      );

      expect(result.ok).toBe(true);
      expect(result.staff.name).toBe('New Name');
      expect(mockAuditLogsService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_STAFF',
        }),
      );
    });

    it('should throw NotFoundException if staff not found', async () => {
      mockWorkersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.patch(
          '999',
          { name: 'New Name' },
          { actorId: '1', actorName: 'Admin' },
          10,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('should soft-delete staff member', async () => {
      const existing: Partial<Worker> = {
        id: '1',
        full_name: 'To Remove',
        worker_code: 'EMP001',
        is_active: true,
        attributes: { position: 'nurse', email: 'remove@test.com' },
      };

      const removed: Partial<Worker> = { ...existing, is_active: false };

      mockWorkersRepo.findOne.mockResolvedValue(existing);
      mockWorkersRepo.remove.mockResolvedValue(removed);

      const result = await service.remove(
        '1',
        { actorId: '1', actorName: 'Admin' },
        10,
      );

      expect(result.ok).toBe(true);
      expect(mockAuditLogsService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_STAFF',
        }),
      );
    });

    it('should throw NotFoundException if staff not found', async () => {
      mockWorkersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.remove('999', { actorId: '1', actorName: 'Admin' }, 10),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
