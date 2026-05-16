import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { messagingApi } from '@line/bot-sdk';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  ChatbotConversation,
  ConversationState,
} from '../../database/entities/workers/chatbot-conversation.entity';
import {
  WorkerAvailability,
  AvailabilityType,
} from '../../database/entities/workers/worker-availability.entity';
import { LineLinkToken } from '../../database/entities/workers/line-link-token.entity';
import { Worker } from '../../database/entities/workers/worker.entity';
import { WorkerPreferencesService } from '../worker-preferences/worker-preferences.service';
import { WorkerPreferencesDto } from '../worker-preferences/dto/put-worker-preferences.dto';

type LineMessage = messagingApi.Message;

// Set MAYWIN_PRIVACY_URL in .env to point to your actual privacy policy page (PDPA §24)
const PRIVACY_POLICY_URL = process.env.MAYWIN_PRIVACY_URL ?? 'https://maywin.app/privacy';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private exhaustedKeys = new Set<string>();
  private lastCheckedDay = new Date().toISOString().split('T')[0];

  // WARNING: Never use Gemini for code generation or modification tasks!
  // Only use Gemini for data extraction or summarization. See: https://github.com/your-org/your-policy
  private readonly GEMINI_MODEL = 'gemma-3-27b-it';

  constructor(
    @InjectRepository(ChatbotConversation)
    private chatbotConversationRepo: Repository<ChatbotConversation>,
    @InjectRepository(WorkerAvailability)
    private workerAvailabilityRepo: Repository<WorkerAvailability>,
    @InjectRepository(Worker)
    private workerRepo: Repository<Worker>,
    @InjectRepository(LineLinkToken)
    private lineLinkTokenRepo: Repository<LineLinkToken>,
    private readonly workerPreferencesService: WorkerPreferencesService,
    private readonly auditLogs: AuditLogsService,
  ) {
    this.logger.log('WebhookService initialized');
  }

  // ── Message builder helpers ──────────────────────────────────────────────────

  private text(str: string): messagingApi.TextMessage {
    return { type: 'text', text: str };
  }

  private buildConsentPromptMessages(): LineMessage[] {
    const body =
      'สวัสดีค่ะ ยินดีต้อนรับสู่ MayWin 🌟\n\n' +
      'ระบบ MayWin ใช้ Google Gemini AI เพื่อช่วยอ่านและเข้าใจข้อความของคุณ\n' +
      'เช่น คำขอวันหยุดหรือกะที่ต้องการ\n\n' +
      '⚠️ หากไม่ยอมรับ ระบบจะไม่สามารถประมวลผลข้อความของคุณได้\n' +
      'และคุณจะไม่สามารถใช้งาน MayWin ผ่าน LINE ได้ค่ะ\n\n' +
      'กรุณาเลือกด้านล่างค่ะ\n\n' +
      '──────────────\n\n' +
      'Welcome to MayWin 🌟\n\n' +
      'MayWin uses Google Gemini AI to understand your messages,\n' +
      'such as leave requests and shift preferences.\n\n' +
      '⚠️ Please note: if you decline, the system will not be able\n' +
      'to process your messages and you will not be able to use\n' +
      'MayWin through LINE.\n\n' +
      'Please choose below.';

    // NOTE: LINE quick reply labels are capped at 20 characters.
    // The labels below are 16–22 chars; verify in LINE OA Manager if any are truncated.
    return [
      {
        type: 'text',
        text: body,
        quickReply: {
          items: [
            {
              type: 'action',
              action: { type: 'postback', label: '✅ ยอมรับ / Agree', data: 'CONSENT_AGREE', displayText: '✅ ยอมรับ' },
            },
            {
              type: 'action',
              action: { type: 'postback', label: '📋 รายละเอียด / Details', data: 'CONSENT_DETAILS', displayText: '📋 รายละเอียด' },
            },
            {
              type: 'action',
              action: { type: 'postback', label: '❌ ไม่ยอมรับ / Decline', data: 'CONSENT_DECLINE', displayText: '❌ ไม่ยอมรับ' },
            },
          ],
        },
      } as messagingApi.TextMessage,
    ];
  }

  private buildAlreadyDeclinedMessages(): LineMessage[] {
    return [
      this.text(
        'คุณได้ปฏิเสธการใช้งาน Google Gemini AI ไปแล้วค่ะ\n' +
        'ระบบ MayWin ผ่าน LINE จึงไม่สามารถใช้งานได้สำหรับคุณค่ะ\n' +
        'หากต้องการเปลี่ยนใจ กรุณาติดต่อหัวหน้าพยาบาลของคุณค่ะ\n\n' +
        '──────────────\n\n' +
        'You have previously declined the use of Google Gemini AI.\n' +
        'MayWin through LINE is therefore not available for you.\n' +
        'If you change your mind, please contact your head nurse.',
      ),
    ];
  }

  private buildConsentDetailsMessages(): LineMessage[] {
    const thaiText =
      'รายละเอียดการใช้ Google Gemini AI\n\n' +
      'ข้อมูลที่ถูกส่งไป Google:\n' +
      'ข้อความที่คุณพิมพ์เท่านั้น ระบบไม่ได้ส่งชื่อ รหัสพนักงาน\n' +
      'หรือข้อมูลส่วนตัวอื่นๆ ของคุณไปให้ Google โดยตรง\n\n' +
      'Google ใช้ข้อมูลเพื่ออะไร:\n' +
      'เพื่อแปลงข้อความของคุณให้เป็นข้อมูลตารางงาน\n' +
      'เช่น วันที่และประเภทกะเท่านั้น\n\n' +
      'การคุ้มครองข้อมูลของคุณ:\n' +
      'Google ผูกพันตามข้อตกลงการประมวลผลข้อมูล (Data Processing Agreement)\n' +
      'ซึ่งกำหนดว่า Google ต้องปกป้องข้อมูลของคุณตามมาตรฐานสากล\n\n' +
      '⚠️ หากไม่ยอมรับ คุณจะไม่สามารถใช้งาน MayWin ผ่าน LINE ได้ค่ะ';

    const englishText =
      'Details about Google Gemini AI usage\n\n' +
      'What is sent to Google:\n' +
      'Only the text of your message. Your name, employee code,\n' +
      'and personal identifiers are not sent to Google directly.\n\n' +
      'What Google uses it for:\n' +
      'Solely to convert your message into scheduling data\n' +
      'such as a date and shift type.\n\n' +
      'How your data is protected:\n' +
      'Google is bound by a Data Processing Agreement which requires\n' +
      'them to protect your data to international standards.\n\n' +
      '⚠️ Please note: if you decline, MayWin through LINE\n' +
      'will not be available for you.';

    const flexMessage: messagingApi.FlexMessage = {
      type: 'flex',
      altText: 'รายละเอียดการใช้ Google Gemini AI | Google Gemini AI Details',
      contents: {
        type: 'bubble',
        size: 'mega',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            { type: 'text', text: 'รายละเอียดการใช้ Google Gemini AI', weight: 'bold', size: 'md', wrap: true },
            { type: 'separator', margin: 'md' },
            { type: 'text', text: thaiText, size: 'sm', wrap: true },
            { type: 'separator', margin: 'md' },
            { type: 'text', text: englishText, size: 'sm', wrap: true },
          ],
        } as any,
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              action: { type: 'uri', label: '📄 MayWin Privacy Policy', uri: PRIVACY_POLICY_URL },
              style: 'secondary',
              height: 'sm',
            },
            {
              type: 'button',
              action: { type: 'uri', label: '🔗 Google Privacy Policy', uri: 'https://policies.google.com/privacy' },
              style: 'link',
              height: 'sm',
            },
            {
              type: 'button',
              action: { type: 'uri', label: '🔗 Gemini API Terms', uri: 'https://ai.google.dev/gemini-api/terms' },
              style: 'link',
              height: 'sm',
            },
            {
              type: 'button',
              action: { type: 'uri', label: '🔗 Google DPA', uri: 'https://cloud.google.com/terms/data-processing-addendum' },
              style: 'link',
              height: 'sm',
            },
          ],
        } as any,
      } as any,
      quickReply: {
        items: [
          {
            type: 'action',
            action: { type: 'postback', label: '✅ ยอมรับ / Agree', data: 'CONSENT_AGREE', displayText: '✅ ยอมรับ' },
          },
          {
            type: 'action',
            action: { type: 'postback', label: '❌ ไม่ยอมรับ / Decline', data: 'CONSENT_DECLINE', displayText: '❌ ไม่ยอมรับ' },
          },
        ],
      },
    };

    return [flexMessage];
  }

  // ── Postback handler ─────────────────────────────────────────────────────────

  async handlePostback(data: string, userId: string): Promise<LineMessage[]> {
    this.logger.log(`[POSTBACK] userId=${userId} data=${data}`);
    try {
      const worker = await this.workerRepo.findOne({ where: { line_id: userId } });
      if (!worker) {
        return [this.text('ไม่พบบัญชีของคุณในระบบค่ะ กรุณาลงทะเบียนก่อนค่ะ\n\nYour account was not found. Please register first.')];
      }

      switch (data) {
        case 'CONSENT_AGREE':
          return this.handleConsentAgree(worker);
        case 'CONSENT_DETAILS':
          return this.buildConsentDetailsMessages();
        case 'CONSENT_DECLINE':
          return this.handleConsentDecline(worker);
        default:
          this.logger.warn(`[POSTBACK] Unrecognised postback data: ${data}`);
          return [];
      }
    } catch (error) {
      this.logger.error('[POSTBACK] handlePostback failed:', error);
      return [this.text('ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งค่ะ')];
    }
  }

  private async handleConsentAgree(worker: Worker): Promise<LineMessage[]> {
    const consentTimestamp = new Date();
    await this.workerRepo.update(worker.id, {
      gemini_consent_given: true,
      gemini_consent_given_at: consentTimestamp,
      gemini_consent_declined_at: null,
    });
    this.logger.log(`[CONSENT] Worker ${worker.id} agreed — gemini_consent_given set to true`);

    const maskedLineId = worker.line_id
      ? `${worker.line_id.slice(0, 6)}****`
      : 'unknown';

    await this.auditLogs.append({
      orgId: String(worker.organization_id),
      actorId: String(worker.id),
      actorName: worker.full_name,
      action: 'GEMINI_CONSENT_GIVEN',
      targetType: 'WORKER',
      targetId: String(worker.id),
      detail: `Gemini AI consent given at ${consentTimestamp.toISOString()}; LINE userId: ${maskedLineId}`,
      level: 2,
    });

    return [
      this.text(
        'ขอบคุณค่ะ คุณสามารถส่งคำขอตารางงานได้เลยค่ะ 😊\n\n' +
        'Thank you! You can now send your scheduling requests.',
      ),
    ];
  }

  private async handleConsentDecline(worker: Worker): Promise<LineMessage[]> {
    const declineTimestamp = new Date();
    await this.workerRepo.update(worker.id, {
      gemini_consent_given: false,
      gemini_consent_declined_at: declineTimestamp,
    });
    this.logger.log(`[CONSENT] Worker ${worker.id} declined — gemini_consent_declined_at set`);

    const maskedLineId = worker.line_id
      ? `${worker.line_id.slice(0, 6)}****`
      : 'unknown';

    await this.auditLogs.append({
      orgId: String(worker.organization_id),
      actorId: String(worker.id),
      actorName: worker.full_name,
      action: 'GEMINI_CONSENT_DECLINED',
      targetType: 'WORKER',
      targetId: String(worker.id),
      detail: `Gemini AI consent declined at ${declineTimestamp.toISOString()}; LINE userId: ${maskedLineId}`,
      level: 2,
    });

    return [
      this.text(
        'คุณได้ปฏิเสธการใช้งาน Google Gemini AI ค่ะ\n\n' +
        'ด้วยเหตุนี้ระบบ MayWin ผ่าน LINE จะไม่สามารถใช้งานได้\n' +
        'สำหรับคุณค่ะ\n\n' +
        'หากต้องการเปลี่ยนใจในภายหลัง\n' +
        'กรุณาติดต่อหัวหน้าพยาบาลของคุณค่ะ\n\n' +
        '──────────────\n\n' +
        'You have declined the use of Google Gemini AI.\n\n' +
        'As a result, MayWin through LINE will not be\n' +
        'available for you.\n\n' +
        'If you change your mind later, please contact\n' +
        'your head nurse.',
      ),
    ];
  }

  // ── Main message handler ─────────────────────────────────────────────────────

  async handleNurseMessage(text: string, userId: string): Promise<LineMessage[]> {
    try {
      this.logger.log(`[INCOMING] UserID: ${userId} | Message: ${text}`);

      const today = new Date().toISOString().split('T')[0];
      if (this.lastCheckedDay !== today) {
        this.lastCheckedDay = today;
        this.exhaustedKeys.clear();
      }

      // ── PHASE 0: LINE Account Linking ────────────────────────────────────────
      // Supported formats (both case-insensitive):
      //   "ลงทะเบียน: CODE"              (code only — legacy)
      //   "ลงทะเบียน ชื่อ นามสกุล: CODE"  (name + code — secure)
      //   "link account: CODE"            (English, code only)
      //   "link account ชื่อ นามสกุล: CODE" (English + name)
      const linkMatch = text.trim().match(
        /^(?:ลงทะเบียน|link\s*account)(?:\s+([^:]+?))?\s*:\s*([a-z0-9]+)$/i,
      );
      if (linkMatch) {
        const suppliedName = linkMatch[1]?.trim() ?? null;
        const code = linkMatch[2].toUpperCase();
        return this.handleLinkAccount(userId, code, suppliedName);
      }

      // ── CONSENT GATE ─────────────────────────────────────────────────────────
      // Runs for all non-link messages. If the worker has not yet given (or has
      // declined) Gemini consent, NLU/Gemini processing is blocked entirely.
      const worker = await this.workerRepo.findOne({ where: { line_id: userId } });
      if (worker) {
        if (worker.gemini_consent_declined_at !== null) {
          // STEP 3: nurse has explicitly declined — block and inform
          this.logger.log(`[CONSENT] Worker ${worker.id} is declined — blocking message`);
          return this.buildAlreadyDeclinedMessages();
        }

        if (!worker.gemini_consent_given) {
          // STEP 2: nurse has never seen the consent prompt — show it now
          this.logger.log(`[CONSENT] Worker ${worker.id} has not consented — sending consent prompt`);
          return this.buildConsentPromptMessages();
        }

        // gemini_consent_given === true → fall through to normal processing
      }
      // No worker found for this line_id → account not linked yet;
      // let the conversation flow continue so downstream can give the right error.

      // Get or create conversation state from database
      let conversation = await this.chatbotConversationRepo.findOne({
        where: { line_user_id: userId },
      });

      if (!conversation) {
        this.logger.log(`[NEW] Creating new conversation for UserID: ${userId}`);
        conversation = this.chatbotConversationRepo.create({
          line_user_id: userId,
          state: ConversationState.IDLE,
        });
        await this.chatbotConversationRepo.save(conversation);
      }

      // --- PHASE 1: Confirmation Logic ---
      if (conversation.state === ConversationState.AWAITING_CONFIRMATION) {
        const input = text.trim().toLowerCase();
        if (['yes', 'ใช่', 'คับ', 'ค่ะ', 'ครับ'].includes(input)) {
          const finalData = conversation.pending_data;

          await this.saveToDatabase(conversation, finalData);

          conversation.state = ConversationState.IDLE;
          conversation.pending_data = null;
          await this.chatbotConversationRepo.save(conversation);

          return [this.text('✅ บันทึกข้อมูลเรียบร้อยแล้วค่ะ!')];
        }

        if (['no', 'ไม่', 'ไม่ใช่'].includes(input)) {
          conversation.state = ConversationState.IDLE;
          conversation.pending_data = null;
          await this.chatbotConversationRepo.save(conversation);

          return [this.text('❌ ยกเลิกรายการให้แล้วค่ะ')];
        }

        return [this.text("⚠️ ขอโทษนะคะ รบกวนช่วยยืนยันโดยพิมพ์ 'ใช่' หรือ 'ไม่' อีกครั้งค่ะ")];
      }

      // --- PHASE 2: Dynamic Key & Model Failover ---
      const allKeys: string[] = Object.keys(process.env)
        .filter((key) => key.startsWith('GEMINI_API_KEY'))
        .map((key) => process.env[key])
        .filter((val): val is string => !!val && !this.exhaustedKeys.has(val));

      this.logger.debug(`[GEMINI] Available keys: ${allKeys.length}`);

      // Try Flash first
      for (const apiKey of allKeys) {
        try {
          const extracted = await this.callGemini(apiKey, 'gemini-2.5-flash', text);
          if (extracted && extracted.length > 0) {
            this.logger.log(`[GEMINI RESPONSE] UserID: ${userId} | Data:`, JSON.stringify(extracted));
            return this.setupConfirmation(conversation, extracted);
          }
        } catch (error: any) {
          if (error.status === 429) {
            this.logger.warn(`[LIMIT] Key ${apiKey.substring(0, 5)}... hit 429 for Flash. Rotating...`);
            this.exhaustedKeys.add(apiKey);
            continue;
          }
          this.logger.error(`[GEMINI ERROR] UserID: ${userId} | Error: ${error.message}`);
          throw error;
        }
      }

      // Fallback to Flash Lite
      const primaryKey = process.env.GEMINI_API_KEY || '';
      if (primaryKey) {
        try {
          const extracted = await this.callGemini(primaryKey, 'gemini-2.5-flash-lite', text);
          if (extracted && extracted.length > 0) {
            this.logger.log(`[GEMINI LITE RESPONSE] UserID: ${userId} | Data:`, JSON.stringify(extracted));
            return this.setupConfirmation(conversation, extracted);
          }
        } catch (error: any) {
          if (error.status === 429) {
            this.logger.warn(`[LIMIT] Flash Lite quota exhausted.`);
          } else {
            throw error;
          }
        }
      }

      // Fallback to GEMINI_MODEL (gemma-3-27b-it)
      if (primaryKey) {
        try {
          const extracted = await this.callGemini(primaryKey, this.GEMINI_MODEL, text);
          if (extracted && extracted.length > 0) {
            this.logger.log(`[GEMINI MODEL FALLBACK RESPONSE] UserID: ${userId} | Data:`, JSON.stringify(extracted));
            return this.setupConfirmation(conversation, extracted);
          }
        } catch (error: any) {
          if (error.status === 429) {
            return [this.text('ขออภัยค่ะ ขณะนี้โควต้าเต็มทุกระบบแล้ว ลองใหม่พรุ่งนี้นะคะ')];
          }
          throw error;
        }
      }

      return [this.text('ขออภัยค่ะ ระบบขัดข้องชั่วคราวเนื่องจากโควต้าเต็ม กรุณาแจ้งแอดมินหรือลองใหม่อีกครั้งพรุ่งนี้นะคะ')];
    } catch (error: any) {
      this.logger.error(`[CRITICAL ERROR] handleNurseMessage failed:`, error);
      return [this.text('ขออภัยค่ะ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งค่ะ')];
    }
  }

  // ── LINE Account Linking ─────────────────────────────────────────────────────

  private normaliseName(raw: string): string {
    return raw
      .replace(/^(นาย|นาง|นางสาว|น\.ส\.|นพ\.|พญ\.|Mr\.|Mrs\.|Ms\.|Miss\.?|Dr\.?)/i, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private nameMatches(supplied: string, workerFullName: string): boolean {
    const s = this.normaliseName(supplied);
    const w = this.normaliseName(workerFullName);
    if (s === w) return true;
    const sFirst = s.split(' ')[0];
    const wFirst = w.split(' ')[0];
    if (sFirst && wFirst && sFirst === wFirst) return true;
    return false;
  }

  private async handleLinkAccount(
    lineUserId: string,
    token: string,
    suppliedName: string | null,
  ): Promise<LineMessage[]> {
    try {
      this.logger.log(`[LINK] Attempting to link LINE user ${lineUserId} with token ${token}`);

      const linkToken = await this.lineLinkTokenRepo.findOne({
        where: { token, used_at: IsNull() },
      });

      if (!linkToken) {
        return [
          this.text(
            [
              '❌ รหัสนี้ไม่ถูกต้องหรือถูกใช้งานแล้วค่ะ',
              '',
              '💡 วิธีลงทะเบียน:',
              'พิมพ์ว่า: ลงทะเบียน: [รหัส]',
              'หรือพิมพ์ชื่อด้วย: ลงทะเบียน ชื่อ-นามสกุล: [รหัส]',
              '',
              'หากไม่มีรหัส กรุณาติดต่อหัวหน้าพยาบาลค่ะ',
            ].join('\n'),
          ),
        ];
      }

      if (linkToken.expires_at < new Date()) {
        return [this.text('❌ รหัสนี้หมดอายุแล้วค่ะ กรุณาขอรหัสใหม่จากหัวหน้าพยาบาลค่ะ')];
      }

      const worker = await this.workerRepo.findOne({ where: { id: linkToken.worker_id as any } });
      if (!worker) {
        return [this.text('❌ ไม่พบข้อมูลบุคลากรในระบบ กรุณาติดต่อหัวหน้าพยาบาลค่ะ')];
      }

      if (!suppliedName) {
        return [
          this.text(
            [
              '⚠️ เพื่อความปลอดภัย กรุณายืนยันตัวตนด้วยค่ะ',
              '',
              'กรุณาพิมพ์ชื่อของคุณพร้อมกับรหัสดังนี้:',
              `ลงทะเบียน [ชื่อ-นามสกุล]: ${token}`,
              '',
              `📋 ตัวอย่าง: ลงทะเบียน ${worker.full_name}: ${token}`,
            ].join('\n'),
          ),
        ];
      }

      if (!this.nameMatches(suppliedName, worker.full_name)) {
        this.logger.warn(
          `[LINK] Name mismatch for token ${token}: supplied="${suppliedName}" expected="${worker.full_name}"`,
        );
        return [
          this.text(
            [
              '❌ ชื่อที่ระบุไม่ตรงกับข้อมูลในระบบค่ะ',
              '',
              'กรุณาตรวจสอบชื่อและลองอีกครั้ง หรือติดต่อหัวหน้าพยาบาลเพื่อตรวจสอบชื่อที่ลงทะเบียนไว้ค่ะ',
            ].join('\n'),
          ),
        ];
      }

      const existingWorker = await this.workerRepo.findOne({ where: { line_id: lineUserId } });

      if (existingWorker) {
        const isSameWorker = String(existingWorker.id) === String(linkToken.worker_id);
        if (!isSameWorker) {
          return [
            this.text(
              [
                '⚠️ LINE account ของคุณเชื่อมต่อกับบัญชีอื่นอยู่แล้วค่ะ',
                '',
                'หากต้องการเปลี่ยนบัญชี กรุณาติดต่อหัวหน้าพยาบาลเพื่อยกเลิกการเชื่อมต่อเดิมก่อนค่ะ',
              ].join('\n'),
            ),
          ];
        }
        this.logger.log(`[LINK] Re-linking LINE ${lineUserId} → same Worker ${linkToken.worker_id}`);
      }

      await this.workerRepo.update(linkToken.worker_id, { line_id: lineUserId });

      linkToken.used_at = new Date();
      await this.lineLinkTokenRepo.save(linkToken);

      const name = worker.full_name ?? 'คุณ';
      this.logger.log(`[LINK] ✅ Linked LINE ${lineUserId} → Worker ${linkToken.worker_id} (${name})`);

      const isRelink = !!existingWorker;
      if (isRelink) {
        return [
          this.text(
            [
              `🔄 รีเฟรชการเชื่อมต่อเรียบร้อยแล้วค่ะ สวัสดีค่ะ ${name}! 😊`,
              '',
              'บัญชีของคุณยังคงเชื่อมต่ออยู่ตามเดิมค่ะ',
            ].join('\n'),
          ),
        ];
      }

      return [
        this.text(
          [
            `✅ เชื่อมต่อบัญชีเรียบร้อยแล้วค่ะ สวัสดีค่ะ ${name}! 😊`,
            '',
            'ตั้งแต่นี้ไปคุณสามารถแจ้งความต้องการเข้าเวรได้เลยค่ะ',
            'ตัวอย่าง: "ขอเวรเช้าวันที่ 20 มีนาคม"',
            '          "ขอลาวันที่ 5-7 เมษายน"',
          ].join('\n'),
        ),
      ];
    } catch (error) {
      this.logger.error('[LINK] handleLinkAccount failed:', error);
      return [this.text('❌ เกิดข้อผิดพลาดในการเชื่อมต่อบัญชี กรุณาลองใหม่หรือติดต่อหัวหน้าพยาบาลค่ะ')];
    }
  }

  private async setupConfirmation(
    conversation: ChatbotConversation,
    extracted: any[],
  ): Promise<LineMessage[]> {
    try {
      conversation.state = ConversationState.AWAITING_CONFIRMATION;
      conversation.pending_data = extracted;
      await this.chatbotConversationRepo.save(conversation);

      const thaiSummary = this.formatThaiSummary(extracted);
      return [this.text(`${thaiSummary}\n\nข้อมูลนี้ถูกต้องไหมคะ? (พิมพ์ 'ใช่' หรือ 'ไม่')`)];
    } catch (error) {
      this.logger.error('[ERROR] setupConfirmation failed:', error);
      throw error;
    }
  }

  private async callGemini(apiKey: string, modelName: string, text: string) {
    try {
      this.logger.debug(`[GEMINI] Calling ${modelName}...`);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json' },
      });

      const today = new Date().toISOString();
      const prompt = `Today is ${today}. Extract nurse shift preferences from: "${text}".
    Return a JSON array of objects: {"date": "YYYY-MM-DD", "shift": "morning|afternoon|night|leave"}.`;

      const result = await model.generateContent(prompt);
      const resultText = result.response.text();
      this.logger.debug(`[GEMINI] Raw response: ${resultText.substring(0, 100)}...`);
      return JSON.parse(resultText.replace(/```json|```/g, '').trim());
    } catch (error) {
      this.logger.error(`[ERROR] callGemini failed:`, error);
      throw error;
    }
  }

  private formatThaiSummary(prefs: any[]): string {
    const shiftMap: { [key: string]: string } = {
      morning: 'เช้า',
      afternoon: 'บ่าย',
      night: 'ดึก',
      leave: 'ลาพัก/ไม่เข้าเวร'
    };
    const summaries = prefs.map((p) => {
      const dateObj = new Date(p.date);
      const formattedDate = dateObj.toLocaleDateString('th-TH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      return `- วัน${formattedDate}: ${p.shift === 'leave' ? 'ขอ "ลาพัก"' : 'เข้า "เวร' + (shiftMap[p.shift] || p.shift) + '"'}`;
    });
    return `สรุปรายการที่คุณต้องการจองค่ะ:\n${summaries.join('\n')}`;
  }

  private async saveToDatabase(conversation: ChatbotConversation, data: any[]) {
    try {
      this.logger.log(
        `✅ [DATABASE SAVE] LineUserID: ${conversation.line_user_id} | Data:`,
        JSON.stringify(data, null, 2),
      );

      if (!conversation.worker_id) {
        const worker = await this.workerRepo.findOne({ where: { line_id: conversation.line_user_id } });
        if (worker) {
          conversation.worker_id = worker.id;
          conversation.organization_id = worker.organization_id;
          conversation.unit_id = worker.primary_unit_id;
          await this.chatbotConversationRepo.save(conversation);
          this.logger.log(
            `🔗 [WORKER LINKED] LineUserID: ${conversation.line_user_id} -> WorkerID: ${worker.id}`,
          );
        } else {
          this.logger.warn(
            `⚠️ [NO WORKER FOUND] LineUserID: ${conversation.line_user_id} - Cannot save availability without worker_id`,
          );
          return;
        }
      }

      try {
        let patternJson: Record<string, any> = {};
        let daysOffPatternJson: Record<string, any> = {};
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.date && item.shift) {
              if (item.shift === 'leave') {
                daysOffPatternJson[item.date] = { type: 'DAY_OFF', source: 'CHATBOT' };
              } else {
                if (!patternJson[item.date]) patternJson[item.date] = {};
                patternJson[item.date][item.shift] = 5;
              }
            }
          });
        }
        const preferences: WorkerPreferencesDto = {
          preference_pattern_json: patternJson,
          days_off_pattern_json: daysOffPatternJson,
          attributes: {
            source: 'CHATBOT',
            line_user_id: conversation.line_user_id,
          },
        };
        await this.workerPreferencesService.upsertPreferences(
          String(conversation.worker_id),
          String(conversation.unit_id || ''),
          preferences,
        );
        this.logger.log(
          `💾 [PREFERENCES SAVED] WorkerID: ${conversation.worker_id} | Pattern: ${JSON.stringify(patternJson)}, DaysOff: ${JSON.stringify(daysOffPatternJson)}`,
        );
      } catch (prefErr) {
        this.logger.error(`[ERROR] Failed to save worker_preferences:`, prefErr);
      }

      const shiftCodeMap: Record<string, string | null> = {
        morning: 'Morning',
        afternoon: 'Afternoon',
        night: 'Night',
        leave: null,
      };

      for (const pref of data) {
        try {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(pref.date)) {
            this.logger.error(`[VALIDATION ERROR] Invalid date format: ${pref.date}`);
            continue;
          }
          const shiftCode = shiftCodeMap[pref.shift];
          let availabilityType = AvailabilityType.PREFERRED;
          if (pref.shift === 'leave') {
            availabilityType = AvailabilityType.DAY_OFF;
          }

          if (pref.shift === 'leave') {
            const existingAvailability = await this.workerAvailabilityRepo.findOne({
              where: {
                worker_id: conversation.worker_id,
                unit_id: conversation.unit_id || '0',
                date: pref.date,
                shift_code: 'ALL',
                type: AvailabilityType.DAY_OFF,
              },
            });

            if (existingAvailability) {
              this.logger.warn(`[VALIDATION] Duplicate DAY_OFF for WorkerID: ${conversation.worker_id} | Date: ${pref.date}`);
              continue;
            }
            const availability = this.workerAvailabilityRepo.create({
              worker_id: conversation.worker_id!,
              unit_id: conversation.unit_id || '0',
              date: pref.date,
              shift_code: 'ALL',
              type: AvailabilityType.DAY_OFF,
              source: 'CHATBOT',
              reason: 'Worker requested day off via chatbot',
              attributes: {
                original_shift: pref.shift,
                line_user_id: conversation.line_user_id,
              },
            });

            await this.workerAvailabilityRepo.save(availability);
            this.logger.log(
              `💾 [SAVED] WorkerID: ${conversation.worker_id} | Date: ${pref.date} | Type: DAY_OFF`,
            );
          } else if (shiftCode) {
            const existingAvailability = await this.workerAvailabilityRepo.findOne({
              where: {
                worker_id: conversation.worker_id,
                unit_id: conversation.unit_id || '0',
                date: pref.date,
                shift_code: shiftCode,
              },
            });

            if (existingAvailability) {
              existingAvailability.type = availabilityType;
              existingAvailability.source = 'CHATBOT';
              existingAvailability.reason = `Worker preferred ${pref.shift} shift via chatbot`;
              existingAvailability.attributes = {
                ...existingAvailability.attributes,
                original_shift: pref.shift,
                line_user_id: conversation.line_user_id,
                updated_at: new Date().toISOString(),
              };
              await this.workerAvailabilityRepo.save(existingAvailability);
              this.logger.log(
                `🔄 [UPDATED] WorkerID: ${conversation.worker_id} | Date: ${pref.date} | Shift: ${shiftCode}`,
              );
            } else {
              const availability = this.workerAvailabilityRepo.create({
                worker_id: conversation.worker_id!,
                unit_id: conversation.unit_id || '0',
                date: pref.date,
                shift_code: shiftCode,
                type: availabilityType,
                source: 'CHATBOT',
                reason: `Worker preferred ${pref.shift} shift via chatbot`,
                attributes: {
                  original_shift: pref.shift,
                  line_user_id: conversation.line_user_id,
                },
              });

              await this.workerAvailabilityRepo.save(availability);
              this.logger.log(
                `💾 [SAVED] WorkerID: ${conversation.worker_id} | Date: ${pref.date} | Shift: ${shiftCode}`,
              );
            }
          }
        } catch (prefError) {
          this.logger.error(`[ERROR] Failed to save preference: ${JSON.stringify(pref)}`, prefError);
        }
      }
    } catch (error) {
      this.logger.error('[ERROR] saveToDatabase failed:', error);
      throw error;
    }
  }
}
