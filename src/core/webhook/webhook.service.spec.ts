import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebhookService } from './webhook.service';
import {
  ChatbotConversation,
  ConversationState,
} from '../../database/entities/workers/chatbot-conversation.entity';
import { WorkerAvailability } from '../../database/entities/workers/worker-availability.entity';
import { Worker } from '../../database/entities/workers/worker.entity';
import { LineLinkToken } from '../../database/entities/workers/line-link-token.entity';
import { WorkerPreferencesService } from '../worker-preferences/worker-preferences.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

// ── Shared fixtures ───────────────────────────────────────────────────────────

// Factory functions — service mutates conversation/worker objects in-place,
// so each test must receive a fresh copy to avoid cross-test state corruption.
const makeLinkedWorker = (): Partial<Worker> => ({
  id: '1',
  full_name: 'Test Nurse',
  organization_id: 'org1',
  primary_unit_id: 'unit1',
  line_id: 'U123',
  line_terms_accepted_at: new Date(),
  line_language: null,
});

const makeIdleConv = (): Partial<ChatbotConversation> => ({
  id: 'conv1',
  line_user_id: 'U123',
  worker_id: '1',
  organization_id: 'org1',
  unit_id: 'unit1',
  state: ConversationState.IDLE,
  pending_data: null,
});

const makeAwaitingConv = (): Partial<ChatbotConversation> => ({
  ...makeIdleConv(),
  state: ConversationState.AWAITING_CONFIRMATION,
  pending_data: [{ date: '2025-03-20', shift: 'morning' }],
});

// ── Test suite ────────────────────────────────────────────────────────────────

describe('WebhookService', () => {
  let service: WebhookService;

  const convRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const workerRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const availRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const tokenRepo = { findOne: jest.fn(), save: jest.fn() };
  const prefService = { upsertPreferences: jest.fn() };
  const auditService = { append: jest.fn().mockResolvedValue({}) };

  beforeEach(async () => {
    jest.clearAllMocks();

    convRepo.findOne.mockImplementation(() => Promise.resolve(makeIdleConv()));
    convRepo.create.mockImplementation(() => makeIdleConv());
    convRepo.save.mockImplementation(() => Promise.resolve(makeIdleConv()));
    convRepo.update.mockResolvedValue({ affected: 1 });

    workerRepo.findOne.mockImplementation(() => Promise.resolve(makeLinkedWorker()));
    workerRepo.update.mockResolvedValue({ affected: 1 });

    availRepo.findOne.mockResolvedValue(null);
    availRepo.create.mockReturnValue({});
    availRepo.save.mockResolvedValue({});

    tokenRepo.findOne.mockResolvedValue(null);
    prefService.upsertPreferences.mockResolvedValue({});

    const module = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: getRepositoryToken(ChatbotConversation), useValue: convRepo },
        { provide: getRepositoryToken(WorkerAvailability), useValue: availRepo },
        { provide: getRepositoryToken(Worker), useValue: workerRepo },
        { provide: getRepositoryToken(LineLinkToken), useValue: tokenRepo },
        { provide: WorkerPreferencesService, useValue: prefService },
        { provide: AuditLogsService, useValue: auditService },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  // ── Pure helpers ──────────────────────────────────────────────────────────

  describe('[HELPER] isHelpCommand', () => {
    const fn = (t: string) => (service as any).isHelpCommand(t);
    it('matches "help"', () => expect(fn('help')).toBe(true));
    it('matches "HELP" (case-insensitive)', () => expect(fn('HELP')).toBe(true));
    it('matches "ช่วย"', () => expect(fn('ช่วย')).toBe(true));
    it('matches "what can you do"', () => expect(fn('what can you do')).toBe(true));
    it('ignores "help me tomorrow"', () => expect(fn('help me tomorrow')).toBe(false));
    it('ignores preference messages', () => expect(fn('I want morning shift')).toBe(false));
  });

  describe('[HELPER] detectLanguageChange', () => {
    const fn = (t: string) => (service as any).detectLanguageChange(t);
    it('"change to english" → en', () => expect(fn('change to english')).toBe('en'));
    it('"switch to english" → en', () => expect(fn('switch to english')).toBe('en'));
    it('"เปลี่ยนเป็นภาษาไทย" → th', () => expect(fn('เปลี่ยนเป็นภาษาไทย')).toBe('th'));
    it('"change to thai" → th', () => expect(fn('change to thai')).toBe('th'));
    it('returns null for normal messages', () => expect(fn('I want morning shift')).toBeNull());
    it('returns null for partial match', () => expect(fn('english is great')).toBeNull());
  });

  describe('[HELPER] formatSummary', () => {
    const fn = (p: any[], l: 'th' | 'en') => (service as any).formatSummary(p, l);

    it('formats morning shift in Thai', () => {
      const r = fn([{ date: '2025-03-20', shift: 'morning' }], 'th');
      expect(r).toContain('เวรเช้า');
    });

    it('formats leave in Thai', () => {
      const r = fn([{ date: '2025-03-20', shift: 'leave' }], 'th');
      expect(r).toContain('ลาพัก');
    });

    it('formats morning shift in English', () => {
      const r = fn([{ date: '2025-03-20', shift: 'morning' }], 'en');
      expect(r).toContain('Morning shift');
    });

    it('formats day off in English', () => {
      const r = fn([{ date: '2025-03-20', shift: 'leave' }], 'en');
      expect(r).toContain('Day off');
    });

    it('filters out null/invalid items from Gemini', () => {
      const r = fn([null, undefined, { date: null, shift: 'morning' }, { date: '2025-03-20', shift: 'morning' }], 'th');
      expect(r).toContain('เวรเช้า');
    });

    it('handles empty array', () => {
      const r = fn([], 'th');
      expect(r).toBeDefined();
    });
  });

  // ── Phase 0: Account linking regex ───────────────────────────────────────

  describe('[PHASE 0] Account linking', () => {
    it('matches Thai registration format', async () => {
      tokenRepo.findOne.mockResolvedValue(null); // token not found → handled in handleLinkAccount
      const r = await service.handleNurseMessage('ลงทะเบียน สมใจ ใจดี: ABC123', 'U999');
      expect(r).toContain('❌'); // token not found
    });

    it('matches English link format', async () => {
      tokenRepo.findOne.mockResolvedValue(null);
      const r = await service.handleNurseMessage('link account John Doe: XYZ456', 'U999');
      expect(r).toContain('❌');
    });

    it('does not intercept normal messages', async () => {
      // "morning shift" should not match the link regex
      const r = await service.handleNurseMessage('morning shift', 'U123');
      expect(r).not.toContain('❌ รหัสนี้ไม่ถูกต้อง');
    });
  });

  // ── Phase 0.5: Terms gate ─────────────────────────────────────────────────

  describe('[PHASE 0.5] Terms gate', () => {
    beforeEach(() => {
      workerRepo.findOne.mockImplementation(() => Promise.resolve({ ...makeLinkedWorker(), line_terms_accepted_at: null }));
    });

    it('shows terms for unaccepted worker', async () => {
      const r = await service.handleNurseMessage('anything', 'U123');
      expect(r).toContain('ยอมรับ');
    });

    it('accepts terms on "ยอมรับ"', async () => {
      const r = await service.handleNurseMessage('ยอมรับ', 'U123');
      expect(r).toContain('ขอบคุณ');
      expect(workerRepo.save).toHaveBeenCalled();
    });

    it('declines terms on "ไม่ยอมรับ"', async () => {
      const r = await service.handleNurseMessage('ไม่ยอมรับ', 'U123');
      expect(r).toContain('ไม่เป็นไร');
    });

    it('re-shows terms for any other input', async () => {
      const r = await service.handleNurseMessage('hello', 'U123');
      expect(r).toContain('ยอมรับ');
    });
  });

  // ── Phase 1: Confirmation ─────────────────────────────────────────────────

  describe('[PHASE 1] Confirmation', () => {
    beforeEach(() => {
      convRepo.findOne.mockImplementation(() => Promise.resolve(makeAwaitingConv()));
    });

    it('"ใช่" saves data and resets state', async () => {
      const r = await service.handleNurseMessage('ใช่', 'U123');
      expect(r).toContain('บันทึก');
      expect(convRepo.update).toHaveBeenCalledWith('conv1', { state: ConversationState.IDLE });
    });

    it('"yes" saves data (English)', async () => {
      const r = await service.handleNurseMessage('yes', 'U123');
      expect(r).toContain('บันทึก');
    });

    it('"ไม่" cancels and resets state', async () => {
      const r = await service.handleNurseMessage('ไม่', 'U123');
      expect(r).toContain('ยกเลิก');
      expect(convRepo.update).toHaveBeenCalledWith('conv1', { state: ConversationState.IDLE });
    });

    it('new preference message falls through — no system error', async () => {
      const r = await service.handleNurseMessage('I want night shift next week', 'U123');
      expect(r).not.toContain('ระบบขัดข้อง');
      expect(r).not.toContain('DEBUG');
    });

    it('null pending_data on yes → notUnderstood, no crash', async () => {
      convRepo.findOne.mockResolvedValue({ ...makeAwaitingConv(), pending_data: null });
      const r = await service.handleNurseMessage('ใช่', 'U123');
      expect(r).not.toContain('DEBUG');
      expect(r).not.toContain('ระบบขัดข้อง');
    });
  });

  // ── Phase 1.5: Help & language ────────────────────────────────────────────

  describe('[PHASE 1.5] Help & language commands', () => {
    it('"help" returns Thai help card', async () => {
      const r = await service.handleNurseMessage('help', 'U123');
      expect(r).toContain('MayWin');
      expect(r).toContain('ขอเวร');
    });

    it('"ช่วย" returns Thai help card', async () => {
      const r = await service.handleNurseMessage('ช่วย', 'U123');
      expect(r).toContain('MayWin');
    });

    it('"change to english" saves language and replies in English', async () => {
      const r = await service.handleNurseMessage('change to english', 'U123');
      expect(r).toContain('English');
      expect(workerRepo.update).toHaveBeenCalledWith('1', { line_language: 'en' });
    });

    it('"change to english" for unlinked user still responds, no crash', async () => {
      workerRepo.findOne.mockResolvedValue(null);
      const r = await service.handleNurseMessage('change to english', 'U999');
      expect(r).toContain('English');
      expect(workerRepo.update).not.toHaveBeenCalled(); // no worker to update
    });

    it('English user gets help card in English', async () => {
      workerRepo.findOne.mockResolvedValue({ ...makeLinkedWorker(), line_language: 'en' });
      const r = await service.handleNurseMessage('help', 'U123');
      expect(r).toContain('Request a shift');
    });
  });

  // ── Phase 2: Gemini (no API key in test env → notUnderstood) ─────────────

  describe('[PHASE 2] Gemini fallback', () => {
    it('random text → notUnderstood (no crash, no system error)', async () => {
      const r = await service.handleNurseMessage('some random text', 'U123');
      expect(r).not.toContain('ระบบขัดข้อง');
      expect(r).not.toContain('DEBUG');
      // With no GEMINI_API_KEY set, falls to notUnderstood
      expect(r).toContain('ไม่แน่ใจ');
    });

    it('setupConfirmation DB failure → notUnderstood, not system error', async () => {
      convRepo.update.mockRejectedValueOnce(new Error('DB timeout'));
      jest.spyOn(service as any, 'callGemini').mockResolvedValue([
        { date: '2025-03-20', shift: 'morning' },
      ]);
      const r = await service.handleNurseMessage('morning shift March 20', 'U123');
      expect(r).not.toContain('ระบบขัดข้อง');
      expect(r).not.toContain('DEBUG');
    });
  });

  // ── DB failure scenarios ──────────────────────────────────────────────────

  describe('[DB] Failure resilience', () => {
    it('convRepo.findOne throws → DEBUG message (not raw crash)', async () => {
      convRepo.findOne.mockRejectedValue(new Error('Connection refused'));
      const r = await service.handleNurseMessage('help', 'U123');
      expect(r).toContain('DEBUG');
      expect(r).toContain('Connection refused');
    });

    it('workerRepo.findOne throws → DEBUG message', async () => {
      workerRepo.findOne.mockRejectedValue(new Error('Query timeout'));
      const r = await service.handleNurseMessage('help', 'U123');
      expect(r).toContain('DEBUG');
      expect(r).toContain('Query timeout');
    });

    it('convRepo.update throws on state reset → notUnderstood, no crash', async () => {
      convRepo.findOne.mockImplementation(() => Promise.resolve(makeAwaitingConv()));
      convRepo.update.mockRejectedValue(new Error('DB error'));
      const r = await service.handleNurseMessage('ไม่', 'U123');
      // Phase 1 no-branch update fails → outer catch → DEBUG
      expect(r).toContain('DEBUG');
    });
  });

  // ── Unlinked user ─────────────────────────────────────────────────────────

  describe('[UNLINKED] No worker account', () => {
    beforeEach(() => {
      workerRepo.findOne.mockResolvedValue(null);
    });

    it('help command still works', async () => {
      const r = await service.handleNurseMessage('help', 'U999');
      expect(r).toContain('MayWin');
    });

    it('random message → notUnderstood (no crash)', async () => {
      const r = await service.handleNurseMessage('some text', 'U999');
      expect(r).not.toContain('DEBUG');
    });
  });
});
