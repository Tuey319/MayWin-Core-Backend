import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
  ) {
    this.logger.log('WebhookService initialized');
  }

  // ── Terms welcome message (hardcoded, no AI) ───────────────────────────
  private readonly TERMS_WELCOME_MESSAGE = [
    'สวัสดีค่ะ 👋',
    '',
    'ระบบ MayWin ใช้ Google Gemini AI เพื่อช่วยอ่านและเข้าใจข้อความของคุณ เช่น คำขอวันหยุดหรือกะที่ต้องการ',
    'โดยคุณสามารถศึกษานโยบายความเป็นส่วนตัวและข้อกำหนดการใช้งานทั้งหมดที่เกี่ยวข้อง',
    '(รวมถึง Google Privacy Policy, Gemini API Terms และ Google DPA) ได้ที่เว็บไซต์ของเรา:',
    '',
    '📄 นโยบายและข้อกำหนดการใช้งาน:',
    'www.maywin.com/landing/privacy-policy',
    '',
    'กรุณาพิมพ์ "ยอมรับ" เพื่อยืนยันและเริ่มใช้งาน',
    'หรือพิมพ์ "ไม่ยอมรับ" หากคุณไม่ต้องการดำเนินการต่อค่ะ',
  ].join('\n');

  private readonly MESSAGES = {
    th: {
      notUnderstood: 'ไม่แน่ใจว่าหมายถึงอะไรค่ะ ลองพิมพ์ "ช่วย" หรือ "help" เพื่อดูตัวอย่างค่ะ',
      help: [
        '🤖 สิ่งที่ MayWin ช่วยได้ค่ะ:',
        '',
        '📅 ขอเวร',
        '  เช่น: "ขอเวรเช้าวันที่ 20 มีนาคม"',
        '',
        '🏖️ ขอลา/วันหยุด',
        '  เช่น: "ขอลาวันที่ 10 เมษายน"',
        '',
        '🌐 เปลี่ยนภาษา',
        '  พิมพ์: "change to english"',
        '',
        '🔗 ลงทะเบียน LINE',
        '  พิมพ์: "ลงทะเบียน ชื่อ-นามสกุล: รหัส"',
      ].join('\n'),
      langChanged: 'ตั้งค่าภาษาเป็นภาษาไทยแล้วค่ะ 🇹🇭',
      confirmationPrompt: "ข้อมูลนี้ถูกต้องไหมคะ? (พิมพ์ 'ใช่' หรือ 'ไม่')",
      summaryHeader: 'สรุปรายการที่คุณต้องการจองค่ะ:',
      saved: '✅ บันทึกข้อมูลเรียบร้อยแล้วค่ะ!',
      cancelled: '❌ ยกเลิกรายการให้แล้วค่ะ',
      confirmRetry: "⚠️ ขอโทษนะคะ รบกวนช่วยยืนยันโดยพิมพ์ 'ใช่' หรือ 'ไม่' อีกครั้งค่ะ",
      quotaExhausted: 'ขออภัยค่ะ ขณะนี้โควต้าเต็มทุกระบบแล้ว ลองใหม่พรุ่งนี้นะคะ',
      systemError: 'ขออภัยค่ะ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งค่ะ',
    },
    en: {
      notUnderstood: 'Not sure what you meant. Type "help" to see what I can do.',
      help: [
        '🤖 What MayWin can do:',
        '',
        '📅 Request a shift',
        '  e.g. "Morning shift on March 20"',
        '',
        '🏖️ Request a day off',
        '  e.g. "Day off on April 10"',
        '',
        '🌐 Change language',
        '  Type: "เปลี่ยนเป็นภาษาไทย"',
        '',
        '🔗 Link account',
        '  Type: "link account First Last: CODE"',
      ].join('\n'),
      langChanged: 'Language set to English 🇬🇧',
      confirmationPrompt: "Is this correct? (type 'yes' or 'no')",
      summaryHeader: "Here's your request:",
      saved: '✅ Saved successfully!',
      cancelled: '❌ Request cancelled.',
      confirmRetry: "⚠️ Please type 'yes' or 'no' to confirm.",
      quotaExhausted: 'Sorry, AI quota is exhausted. Please try again tomorrow.',
      systemError: 'Sorry, a temporary error occurred. Please try again.',
    },
  } as const;

  private isHelpCommand(text: string): boolean {
    const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
    return /^(help|ช่วย|help me|what can you do|ช่วยด้วย|คุณทำอะไรได้บ้าง|ทำอะไรได้บ้าง|ใช้งานอย่างไร|วิธีใช้)$/.test(t);
  }

  private detectLanguageChange(text: string): 'th' | 'en' | null {
    const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
    if (/^(change to english|switch to english|use english|set language to english|เปลี่ยนเป็นภาษาอังกฤษ|ใช้ภาษาอังกฤษ)$/.test(t)) return 'en';
    if (/^(change to thai|switch to thai|use thai|set language to thai|เปลี่ยนเป็นภาษาไทย|ใช้ภาษาไทย)$/.test(t)) return 'th';
    return null;
  }

  async handleNurseMessage(text: string, userId: string): Promise<string> {
    try {
      this.logger.log(`[INCOMING] UserID: ${userId} | Message: ${text}`);

      const today = new Date().toISOString().split('T')[0];
      if (this.lastCheckedDay !== today) {
        this.lastCheckedDay = today;
        this.exhaustedKeys.clear();
      }

      // ── PHASE 0: LINE Account Linking ──────────────────────────────────────
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

      // ── PHASE 0.5: Terms & Conditions Gate ────────────────────────────────
      // Only applies to linked workers. Unlinked users (no worker record) are
      // not gated here — they'll naturally hit the "link your account first" path.
      // Once a worker has accepted (line_terms_accepted_at IS NOT NULL) this
      // block is skipped entirely on every subsequent message.
      const linkedWorker = conversation.worker_id
        ? await this.workerRepo.findOne({ where: { id: conversation.worker_id as any } })
        : await this.workerRepo.findOne({ where: { line_id: userId } });

      if (linkedWorker && !linkedWorker.line_terms_accepted_at) {
        // Worker is linked but has NOT accepted yet
        const input = text.trim();
        const normalised = input.replace(/\s+/g, '');

        if (normalised === 'ยอมรับ') {
          // ✅ Accept
          linkedWorker.line_terms_accepted_at = new Date();
          await this.workerRepo.save(linkedWorker);

          // Sync conversation worker_id in case it wasn't set yet
          if (!conversation.worker_id) {
            conversation.worker_id = linkedWorker.id;
            conversation.organization_id = linkedWorker.organization_id;
            conversation.unit_id = linkedWorker.primary_unit_id;
          }
          conversation.state = ConversationState.IDLE;
          await this.chatbotConversationRepo.save(conversation);

          this.logger.log(`[TERMS] Worker ${linkedWorker.id} accepted terms via LINE`);
          return [
            `✅ ขอบคุณค่ะ ${linkedWorker.full_name ?? 'คุณ'}!`,
            '',
            'คุณสามารถเริ่มใช้งานได้เลยค่ะ 😊',
            'ตัวอย่าง: "ขอเวรเช้าวันที่ 20 มีนาคม" หรือ "ขอลาวันที่ 5 เมษายน"',
          ].join('\n');
        }

        if (normalised === 'ไม่ยอมรับ') {
          // ❌ Decline — stay not accepted, give a calm response
          this.logger.log(`[TERMS] Worker ${linkedWorker.id} declined terms via LINE`);
          return [
            'ได้เลยค่ะ ไม่เป็นไรนะคะ 🙏',
            '',
            'หากเปลี่ยนใจในภายหลัง สามารถพิมพ์ "ยอมรับ" ได้เลยค่ะ',
            'ระบบจะพร้อมใช้งานทันทีที่คุณยืนยันค่ะ',
          ].join('\n');
        }

        // Any other input — gently re-show the consent message
        return this.TERMS_WELCOME_MESSAGE;
      }

      // ── PHASE 0.6: Show welcome/terms for first message of an unlinked user ─
      // If there's no linked worker at all, skip the terms gate (they need to
      // link first). The message below is handled downstream naturally.

      const lang: 'th' | 'en' = linkedWorker?.line_language === 'en' ? 'en' : 'th';
      const msg = this.MESSAGES[lang];

      // --- PHASE 1: Confirmation Logic ---
      if (conversation.state === ConversationState.AWAITING_CONFIRMATION) {
        const input = text.trim().toLowerCase();
        if (['yes', 'ใช่', 'คับ', 'ค่ะ', 'ครับ'].includes(input)) {
          const finalData = conversation.pending_data;

          // Save to database
          await this.saveToDatabase(conversation, finalData);

          // Reset conversation state
          conversation.state = ConversationState.IDLE;
          conversation.pending_data = null;
          await this.chatbotConversationRepo.save(conversation);

          return msg.saved;
        }

        if (['no', 'ไม่', 'ไม่ใช่'].includes(input)) {
          conversation.state = ConversationState.IDLE;
          conversation.pending_data = null;
          await this.chatbotConversationRepo.save(conversation);

          return msg.cancelled;
        }

        // Not yes/no — treat as new request: cancel pending and fall through to Gemini
        conversation.state = ConversationState.IDLE;
        conversation.pending_data = null;
        await this.chatbotConversationRepo.save(conversation);
      }

      // --- PHASE 1.5: Help & language commands (no AI needed) ---
      if (this.isHelpCommand(text)) {
        return msg.help;
      }

      const langChange = this.detectLanguageChange(text);
      if (langChange !== null) {
        if (linkedWorker) {
          linkedWorker.line_language = langChange;
          await this.workerRepo.save(linkedWorker);
        }
        return this.MESSAGES[langChange].langChanged;
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
            // LOG: Gemini response and ID
            this.logger.log(`[GEMINI RESPONSE] UserID: ${userId} | Data:`, JSON.stringify(extracted));
            return this.setupConfirmation(conversation, extracted, lang);
          }
        } catch (error: any) {
          if (error.status === 429) {
            this.logger.warn(`[LIMIT] Key ${apiKey.substring(0, 5)}... hit 429 for Flash. Rotating...`);
            this.exhaustedKeys.add(apiKey);
            continue;
          }
          this.logger.error(`[GEMINI ERROR] UserID: ${userId} | Flash error: ${error.message}`);
          // Non-quota error — try next key/model instead of aborting
        }
      }

      // Fallback to Flash Lite
      const primaryKey = process.env.GEMINI_API_KEY || '';
      if (primaryKey) {
        try {
          const extracted = await this.callGemini(primaryKey, 'gemini-2.5-flash-lite', text);
          if (extracted && extracted.length > 0) {
            this.logger.log(`[GEMINI LITE RESPONSE] UserID: ${userId} | Data:`, JSON.stringify(extracted));
            return this.setupConfirmation(conversation, extracted, lang);
          }
        } catch (error: any) {
          if (error.status === 429) {
            this.logger.warn(`[LIMIT] Flash Lite quota exhausted.`);
          } else {
            this.logger.error(`[GEMINI ERROR] UserID: ${userId} | Flash Lite error: ${error.message}`);
          }
          // Continue to next fallback regardless
        }
      }

      // Fallback to GEMINI_MODEL (gemma-3-27b-it)
      if (primaryKey) {
        try {
          const extracted = await this.callGemini(primaryKey, this.GEMINI_MODEL, text);
          if (extracted && extracted.length > 0) {
            this.logger.log(`[GEMINI MODEL FALLBACK RESPONSE] UserID: ${userId} | Data:`, JSON.stringify(extracted));
            return this.setupConfirmation(conversation, extracted, lang);
          }
        } catch (error: any) {
          if (error.status === 429) {
            return msg.quotaExhausted;
          }
          this.logger.error(`[GEMINI ERROR] UserID: ${userId} | Gemma fallback error: ${error.message}`);
          // Fall through to notUnderstood
        }
      }

      // All models returned empty — AI couldn't extract any shift/leave data
      return msg.notUnderstood;
    } catch (error: any) {
      this.logger.error(`[CRITICAL ERROR] handleNurseMessage failed:`, error);
      return 'ขออภัยค่ะ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งค่ะ';
    }
  }

  // ── LINE Account Linking ─────────────────────────────────────────────────

  /**
   * Normalises a Thai/English name for comparison.
   * Strips common honorifics, collapses whitespace, lowercases.
   */
  private normaliseName(raw: string): string {
    return raw
      .replace(/^(นาย|นาง|นางสาว|น\.ส\.|นพ\.|พญ\.|Mr\.|Mrs\.|Ms\.|Miss\.?|Dr\.?)/i, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  /**
   * Returns true when the nurse's supplied name is a close enough match
   * to the worker record's full_name.
   *   - Full match after normalisation: always passes
   *   - First name (first token) match:  passes (many Thai nurses use only first name)
   *   - Mismatch:                         fails
   */
  private nameMatches(supplied: string, workerFullName: string): boolean {
    const s = this.normaliseName(supplied);
    const w = this.normaliseName(workerFullName);
    if (s === w) return true; // exact
    // first token (first name) match
    const sFirst = s.split(' ')[0];
    const wFirst = w.split(' ')[0];
    if (sFirst && wFirst && sFirst === wFirst) return true;
    return false;
  }

  private async handleLinkAccount(
    lineUserId: string,
    token: string,
    suppliedName: string | null,
  ): Promise<string> {
    try {
      this.logger.log(`[LINK] Attempting to link LINE user ${lineUserId} with token ${token}`);

      const linkToken = await this.lineLinkTokenRepo.findOne({
        where: { token, used_at: IsNull() },
      });

      if (!linkToken) {
        return [
          '❌ รหัสนี้ไม่ถูกต้องหรือถูกใช้งานแล้วค่ะ',
          '',
          '💡 วิธีลงทะเบียน:',
          'พิมพ์ว่า: ลงทะเบียน: [รหัส]',
          'หรือพิมพ์ชื่อด้วย: ลงทะเบียน ชื่อ-นามสกุล: [รหัส]',
          '',
          'หากไม่มีรหัส กรุณาติดต่อหัวหน้าพยาบาลค่ะ',
        ].join('\n');
      }

      if (linkToken.expires_at < new Date()) {
        return '❌ รหัสนี้หมดอายุแล้วค่ะ กรุณาขอรหัสใหม่จากหัวหน้าพยาบาลค่ะ';
      }

      // Fetch the worker attached to this token
      const worker = await this.workerRepo.findOne({ where: { id: linkToken.worker_id as any } });
      if (!worker) {
        return '❌ ไม่พบข้อมูลบุคลากรในระบบ กรุณาติดต่อหัวหน้าพยาบาลค่ะ';
      }

      // ── Name verification ────────────────────────────────────────────────
      // If nurse included their name in the command, verify it matches.
      // If they did NOT include a name, prompt them to confirm.
      if (!suppliedName) {
        return [
          '⚠️ เพื่อความปลอดภัย กรุณายืนยันตัวตนด้วยค่ะ',
          '',
          'กรุณาพิมพ์ชื่อของคุณพร้อมกับรหัสดังนี้:',
          `ลงทะเบียน [ชื่อ-นามสกุล]: ${token}`,
          '',
          `📋 ตัวอย่าง: ลงทะเบียน ${worker.full_name}: ${token}`,
        ].join('\n');
      }

      if (!this.nameMatches(suppliedName, worker.full_name)) {
        this.logger.warn(
          `[LINK] Name mismatch for token ${token}: supplied="${suppliedName}" expected="${worker.full_name}"`,
        );
        return [
          '❌ ชื่อที่ระบุไม่ตรงกับข้อมูลในระบบค่ะ',
          '',
          'กรุณาตรวจสอบชื่อและลองอีกครั้ง หรือติดต่อหัวหน้าพยาบาลเพื่อตรวจสอบชื่อที่ลงทะเบียนไว้ค่ะ',
        ].join('\n');
      }

      // Check if this LINE ID is already linked anywhere
      const existingWorker = await this.workerRepo.findOne({ where: { line_id: lineUserId } });

      if (existingWorker) {
        const isSameWorker = String(existingWorker.id) === String(linkToken.worker_id);

        if (!isSameWorker) {
          // Linked to a completely different account — block and advise head nurse
          return [
            '⚠️ LINE account ของคุณเชื่อมต่อกับบัญชีอื่นอยู่แล้วค่ะ',
            '',
            'หากต้องการเปลี่ยนบัญชี กรุณาติดต่อหัวหน้าพยาบาลเพื่อยกเลิกการเชื่อมต่อเดิมก่อนค่ะ',
          ].join('\n');
        }

        // Same worker — this is a re-link (e.g. refreshing after regenerating token)
        // Proceed but let them know
        this.logger.log(`[LINK] Re-linking LINE ${lineUserId} → same Worker ${linkToken.worker_id}`);
      }

      // Link (or re-link) the worker's LINE ID
      await this.workerRepo.update(linkToken.worker_id, { line_id: lineUserId });

      // Mark token used
      linkToken.used_at = new Date();
      await this.lineLinkTokenRepo.save(linkToken);

      const name = worker.full_name ?? 'คุณ';
      this.logger.log(`[LINK] ✅ Linked LINE ${lineUserId} → Worker ${linkToken.worker_id} (${name})`);

      const isRelink = !!existingWorker; // existingWorker is same worker at this point
      if (isRelink) {
        // Re-link: worker already exists — check if they've accepted terms before
        const freshWorker = await this.workerRepo.findOne({ where: { id: linkToken.worker_id as any } });
        if (freshWorker?.line_terms_accepted_at) {
          return [
            `🔄 รีเฟรชการเชื่อมต่อเรียบร้อยแล้วค่ะ สวัสดีค่ะ ${name}! 😊`,
            '',
            'บัญชีของคุณยังคงเชื่อมต่ออยู่ตามเดิมค่ะ',
          ].join('\n');
        } else {
          return [
            `🔄 รีเฟรชการเชื่อมต่อเรียบร้อยแล้วค่ะ`,
            '',
            this.TERMS_WELCOME_MESSAGE,
          ].join('\n');
        }
      }

      // Fresh link — show terms consent before anything else
      return [
        `✅ เชื่อมต่อบัญชีเรียบร้อยแล้วค่ะ สวัสดีค่ะ ${name}! 😊`,
        '',
        'ก่อนเริ่มใช้งาน กรุณาอ่านและยอมรับนโยบายการใช้งานของเราก่อนนะคะ:',
        '',
        this.TERMS_WELCOME_MESSAGE,
      ].join('\n');
    } catch (error) {
      this.logger.error('[LINK] handleLinkAccount failed:', error);
      return '❌ เกิดข้อผิดพลาดในการเชื่อมต่อบัญชี กรุณาลองใหม่หรือติดต่อหัวหน้าพยาบาลค่ะ';
    }
  }

  private async setupConfirmation(
    conversation: ChatbotConversation,
    extracted: any[],
    lang: 'th' | 'en' = 'th',
  ): Promise<string> {
    try {
      conversation.state = ConversationState.AWAITING_CONFIRMATION;
      conversation.pending_data = extracted;
      await this.chatbotConversationRepo.save(conversation);

      const summary = this.formatSummary(extracted, lang);
      const prompt = this.MESSAGES[lang].confirmationPrompt;
      return `${summary}\n\n${prompt}`;
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
      const cleaned = resultText.replace(/```json|```/g, '').trim();
      try {
        return JSON.parse(cleaned);
      } catch {
        // Model returned non-JSON (error message, explanation, etc.) — treat as no extraction
        this.logger.warn(`[GEMINI] ${modelName} non-JSON response: ${cleaned.substring(0, 120)}`);
        return [];
      }
    } catch (error) {
      this.logger.error(`[ERROR] callGemini failed:`, error);
      throw error;
    }
  }

  private formatSummary(prefs: any[], lang: 'th' | 'en'): string {
    const shiftMapTh: Record<string, string> = { morning: 'เช้า', afternoon: 'บ่าย', night: 'ดึก' };
    const shiftMapEn: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' };
    const locale = lang === 'en' ? 'en-US' : 'th-TH';
    const header = this.MESSAGES[lang].summaryHeader;

    const summaries = prefs.map((p) => {
      const dateStr = new Date(p.date).toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      const prefix = lang === 'en' ? dateStr : `วัน${dateStr}`;
      let label: string;
      if (p.shift === 'leave') {
        label = lang === 'en' ? 'Day off' : 'ขอ "ลาพัก"';
      } else if (lang === 'en') {
        label = `${shiftMapEn[p.shift] ?? p.shift} shift`;
      } else {
        label = `เข้า "เวร${shiftMapTh[p.shift] ?? p.shift}"`;
      }
      return `- ${prefix}: ${label}`;
    });

    return `${header}\n${summaries.join('\n')}`;
  }

  private async saveToDatabase(conversation: ChatbotConversation, data: any[]) {
    try {
      this.logger.log(
        `✅ [DATABASE SAVE] LineUserID: ${conversation.line_user_id} | Data:`,
        JSON.stringify(data, null, 2),
      );

      // If worker is not linked, try to find worker by line_id column
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

      // --- Insert/Update worker_preferences ---
      try {
        // Separate normal preferences and days off
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

      // Map shift types to shift codes
      const shiftCodeMap: Record<string, string | null> = {
        morning: 'Morning',
        afternoon: 'Afternoon',
        night: 'Night',
        leave: null, // For leave, we don't specify a shift_code but mark as DAY_OFF
      };

      // Save each preference as WorkerAvailability
      for (const pref of data) {
        try {
          // Validate date format
          if (!/^\d{4}-\d{2}-\d{2}$/.test(pref.date)) {
            this.logger.error(`[VALIDATION ERROR] Invalid date format: ${pref.date}`);
            continue;
          }
          // Prevent duplicate days off
          const shiftCode = shiftCodeMap[pref.shift];
          let availabilityType = AvailabilityType.PREFERRED;
          if (pref.shift === 'leave') {
            availabilityType = AvailabilityType.DAY_OFF;
          }

          if (pref.shift === 'leave') {
            // Create DAY_OFF for all shifts on that date
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
            // Check if this preference already exists
            const existingAvailability = await this.workerAvailabilityRepo.findOne({
              where: {
                worker_id: conversation.worker_id,
                unit_id: conversation.unit_id || '0',
                date: pref.date,
                shift_code: shiftCode,
              },
            });

            if (existingAvailability) {
              // Update existing
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
              // Create new
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
          // Continue with next preference
        }
      }
    } catch (error) {
      this.logger.error('[ERROR] saveToDatabase failed:', error);
      throw error;
    }
  }
}
