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

          return `✅ บันทึกข้อมูลเรียบร้อยแล้วค่ะ!`;
        }

        if (['no', 'ไม่', 'ไม่ใช่'].includes(input)) {
          // Reset conversation state
          conversation.state = ConversationState.IDLE;
          conversation.pending_data = null;
          await this.chatbotConversationRepo.save(conversation);

          return '❌ ยกเลิกรายการให้แล้วค่ะ';
        }

        return "⚠️ ขอโทษนะคะ รบกวนช่วยยืนยันโดยพิมพ์ 'ใช่' หรือ 'ไม่' อีกครั้งค่ะ";
      }

      // --- PHASE 2 GUARD: Gemini disabled in production ---
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn('[NLU] Gemini disabled in production — falling back to structured parser');
        const extracted = this.parseStructured(text);
        if (extracted.length > 0) {
          return this.setupConfirmation(conversation, extracted);
        }
        return 'ขออภัยค่ะ ระบบ AI ปิดให้บริการชั่วคราว กรุณาติดต่อหัวหน้าพยาบาลโดยตรงค่ะ';
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
            return this.setupConfirmation(conversation, extracted);
          }
        } catch (error: any) {
          if (error.status === 429) {
            this.logger.warn(`[LIMIT] Key ${apiKey.substring(0, 5)}... hit 429 for Flash. Rotating...`);
            this.exhaustedKeys.add(apiKey);
            continue;
          }
          // LOG: Gemini Error and ID
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
            // Continue to next fallback
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
            return 'ขออภัยค่ะ ขณะนี้โควต้าเต็มทุกระบบแล้ว ลองใหม่พรุ่งนี้นะคะ';
          }
          throw error;
        }
      }

      return 'ขออภัยค่ะ ระบบขัดข้องชั่วคราวเนื่องจากโควต้าเต็ม กรุณาแจ้งแอดมินหรือลองใหม่อีกครั้งพรุ่งนี้นะคะ';
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
        return [
          `🔄 รีเฟรชการเชื่อมต่อเรียบร้อยแล้วค่ะ สวัสดีค่ะ ${name}! 😊`,
          '',
          'บัญชีของคุณยังคงเชื่อมต่ออยู่ตามเดิมค่ะ',
        ].join('\n');
      }

      return [
        `✅ เชื่อมต่อบัญชีเรียบร้อยแล้วค่ะ สวัสดีค่ะ ${name}! 😊`,
        '',
        'ตั้งแต่นี้ไปคุณสามารถแจ้งความต้องการเข้าเวรได้เลยค่ะ',
        'ตัวอย่าง: "ขอเวรเช้าวันที่ 20 มีนาคม"',
        '          "ขอลาวันที่ 5-7 เมษายน"',
      ].join('\n');
    } catch (error) {
      this.logger.error('[LINK] handleLinkAccount failed:', error);
      return '❌ เกิดข้อผิดพลาดในการเชื่อมต่อบัญชี กรุณาลองใหม่หรือติดต่อหัวหน้าพยาบาลค่ะ';
    }
  }

  private async setupConfirmation(
    conversation: ChatbotConversation,
    extracted: any[],
  ): Promise<string> {
    try {
      conversation.state = ConversationState.AWAITING_CONFIRMATION;
      conversation.pending_data = extracted;
      await this.chatbotConversationRepo.save(conversation);

      const thaiSummary = this.formatThaiSummary(extracted);
      return `${thaiSummary}\n\nข้อมูลนี้ถูกต้องไหมคะ? (พิมพ์ 'ใช่' หรือ 'ไม่')`;
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

  private parseStructured(message: string): { date: string; shift: string }[] {
    const results: { date: string; shift: string }[] = [];

    const monthMap: Record<string, number> = {
      'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6,
      'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12,
      'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
      'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
    };

    let shift = 'leave';
    if (message.match(/เช้า|morning/i)) shift = 'morning';
    else if (message.match(/บ่าย|afternoon/i)) shift = 'afternoon';
    else if (message.match(/ดึก|night/i)) shift = 'night';
    else if (message.match(/ลา|day.?off|หยุด|\boff\b/i)) shift = 'leave';

    const datePattern = /(\d{1,2})\s*(พ\.ค\.|มี\.ค\.|เม\.ย\.|ม\.ค\.|ก\.พ\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/gi;
    let match: RegExpExecArray | null;
    const year = new Date().getFullYear();

    while ((match = datePattern.exec(message)) !== null) {
      const day = parseInt(match[1], 10);
      const monthRaw = match[2];
      const month = monthMap[monthRaw] ?? monthMap[monthRaw.toLowerCase()];
      if (!month) continue;
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      results.push({ date, shift });
    }

    return results;
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
