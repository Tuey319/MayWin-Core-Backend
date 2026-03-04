import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ChatbotConversation,
  ConversationState,
} from '../../database/entities/workers/chatbot-conversation.entity';
import {
  WorkerAvailability,
  AvailabilityType,
} from '../../database/entities/workers/worker-availability.entity';

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
    private readonly workerPreferencesService: WorkerPreferencesService,
  ) {
    this.logger.log('WebhookService initialized');
  }

  async handleNurseMessage(text: string, userId: string): Promise<string> {
    try {
      // LOG: Received message and ID
      this.logger.log(`[INCOMING] UserID: ${userId} | Message: ${text}`);

      const today = new Date().toISOString().split('T')[0];

      if (this.lastCheckedDay !== today) {
        this.lastCheckedDay = today;
        this.exhaustedKeys.clear();
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
