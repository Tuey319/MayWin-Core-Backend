// src/core/webhook/webhook.controller.ts
import { Controller, Post, Body, Get, Logger, Req, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import type { Request } from 'express';
import * as crypto from 'crypto';
import { WebhookService } from './webhook.service';
import { messagingApi } from '@line/bot-sdk';

// ── In-memory autoreply gate (no DB, resets on deploy) ──────────────────────
// autoReplyEnabled = true  → normal behaviour
// autoReplyEnabled = false → messages are received but no bot reply is sent
let autoReplyEnabled = true;
let autoReplyResumeAt: Date | null = null;
let autoReplyTimer: ReturnType<typeof setTimeout> | null = null;

function enableAutoReply() {
  autoReplyEnabled = true;
  autoReplyResumeAt = null;
  if (autoReplyTimer) { clearTimeout(autoReplyTimer); autoReplyTimer = null; }
}

function disableAutoReply(durationMs: number) {
  if (autoReplyTimer) clearTimeout(autoReplyTimer);
  autoReplyEnabled = false;
  autoReplyResumeAt = new Date(Date.now() + durationMs);
  autoReplyTimer = setTimeout(() => enableAutoReply(), durationMs);
}

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private client = new messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  });

  constructor(private readonly webhookService: WebhookService) {
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      this.logger.warn('⚠️ LINE_CHANNEL_ACCESS_TOKEN not set!');
    }
    if (!process.env.LINE_CHANNEL_SECRET) {
      this.logger.warn('⚠️ LINE_CHANNEL_SECRET not set — signature verification DISABLED');
    }
  }

  /** Verify that the webhook payload actually came from LINE */
  private verifySignature(rawBody: Buffer | string, signature: string): boolean {
    const secret = process.env.LINE_CHANNEL_SECRET;
    if (!secret) {
      // In dev without secret configured — allow through with a warning
      this.logger.warn('[WEBHOOK] LINE_CHANNEL_SECRET not set — skipping signature check');
      return true;
    }
    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');
    return hash === signature;
  }

  // ── /webhook/autoreply — GET: current state ────────────────────────────────
  @Get('autoreply')
  getAutoReplyStatus() {
    const secondsRemaining = autoReplyResumeAt
      ? Math.max(0, Math.round((autoReplyResumeAt.getTime() - Date.now()) / 1000))
      : null;
    return {
      enabled: autoReplyEnabled,
      resumeAt: autoReplyResumeAt?.toISOString() ?? null,
      secondsRemaining,
    };
  }

  // ── /webhook/autoreply — POST: toggle ──────────────────────────────────────
  // Body: { enabled: boolean, durationMinutes?: number }  (1–60 min, default 10)
  @Post('autoreply')
  setAutoReply(@Body() body: { enabled: boolean; durationMinutes?: number }) {
    const { enabled, durationMinutes = 10 } = body ?? {};
    if (typeof enabled !== 'boolean') {
      throw new HttpException('"enabled" must be a boolean', HttpStatus.BAD_REQUEST);
    }
    if (enabled) {
      enableAutoReply();
      this.logger.log('[AUTOREPLY] Auto-reply RE-ENABLED by admin');
    } else {
      const clampedMinutes = Math.min(60, Math.max(1, Number(durationMinutes) || 10));
      disableAutoReply(clampedMinutes * 60 * 1000);
      this.logger.warn(`[AUTOREPLY] Auto-reply DISABLED for ${clampedMinutes} min by admin`);
    }
    return this.getAutoReplyStatus();
  }

  private async reply(replyToken: string, messages: messagingApi.Message[]): Promise<void> {
    if (!messages.length) return;
    await this.client.replyMessage({ replyToken, messages });
  }

  @Public()
  @Post()
  @HttpCode(200)
  async handleLineWebhook(@Req() req: Request, @Body() body: any) {
    // ── Signature Verification ─────────────────────────────────────────────
    const signature = req.headers['x-line-signature'] as string;
    const rawBody = (req as any).rawBody as Buffer;

    if (signature && rawBody) {
      if (!this.verifySignature(rawBody, signature)) {
        this.logger.warn('[WEBHOOK] Invalid LINE signature — request rejected');
        // Still return 200 so LINE doesn't retry (it already knows we rejected it)
        return { status: 'rejected' };
      }
    }

    try {
      const events = body.events || [];
      this.logger.debug(`[WEBHOOK] Received ${events.length} events`);

      for (const event of events) {
        try {
          // ── Text messages ────────────────────────────────────────────────
          if (event.type === 'message' && event.message?.type === 'text') {
            const userId = event.source.userId || event.source.groupId || 'unknown';
            const message = event.message.text;
            this.logger.log(`[LINE] userId: ${userId}, message: ${message}`);

            if (!autoReplyEnabled) {
              this.logger.warn(`[AUTOREPLY DISABLED] Skipping reply to userId: ${userId}`);
              continue;
            }

            const messages = await this.webhookService.handleNurseMessage(message, userId);
            this.logger.log(`[REPLY] userId: ${userId}, messageCount: ${messages.length}`);
            await this.reply(event.replyToken, messages);
            continue;
          }

          // ── Postback events (consent buttons) ───────────────────────────
          if (event.type === 'postback') {
            const userId = event.source.userId || event.source.groupId || 'unknown';
            const data: string = event.postback?.data ?? '';
            this.logger.log(`[POSTBACK] userId: ${userId}, data: ${data}`);

            const messages = await this.webhookService.handlePostback(data, userId);
            await this.reply(event.replyToken, messages);
            continue;
          }
        } catch (error) {
          this.logger.error(`[ERROR] Processing event failed:`, error);
          try {
            await this.client.replyMessage({
              replyToken: event.replyToken,
              messages: [{ type: 'text', text: '❌ ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้งค่ะ' }],
            });
          } catch (replyError) {
            this.logger.error(`[ERROR] Failed to send error reply:`, replyError);
          }
        }
      }
      return { status: 'ok' };
    } catch (error) {
      this.logger.error(`[ERROR] Webhook handler failed:`, error);
      return { status: 'ok' };
    }
  }
}
