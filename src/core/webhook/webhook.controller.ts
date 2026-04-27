// src/core/webhook/webhook.controller.ts
import { Controller, Post, Body, Logger, Req, HttpCode } from '@nestjs/common';
import type { Request } from 'express';
import * as crypto from 'crypto';
import { WebhookService } from './webhook.service';
import { messagingApi } from '@line/bot-sdk';
import { Public } from '@/common/decorators/public.decorator';

@Public()
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

  /**
   * Verify that the webhook payload actually came from LINE.
   * LINE_CHANNEL_SECRET is mandatory — fail hard if missing (ISO 27001 A.13.1.1)
   */
  private verifySignature(rawBody: Buffer | string, signature: string): boolean {
    const secret = process.env.LINE_CHANNEL_SECRET;
    if (!secret) {
      this.logger.error('[WEBHOOK] LINE_CHANNEL_SECRET is not configured — rejecting all requests');
      return false;
    }
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  @Post()
  @HttpCode(200)
  async handleLineWebhook(@Req() req: Request, @Body() body: any) {
    // ── Signature Verification — always enforced (ISO 27001 A.13.1.1) ──────
    const signature = req.headers['x-line-signature'] as string;
    const rawBody = (req as any).rawBody as Buffer;

    if (!signature || !rawBody || !this.verifySignature(rawBody, signature)) {
      this.logger.warn('[WEBHOOK] Invalid or missing LINE signature — request rejected');
      return { status: 'rejected' };
    }

    try {
      const events = body.events || [];
      this.logger.debug(`[WEBHOOK] Received ${events.length} events`);

      for (const event of events) {
        try {
          if (event.type === 'message' && event.message.type === 'text') {
            const userId = event.source.userId || event.source.groupId || 'unknown';
            const message = event.message.text;
            this.logger.log(`[LINE] userId: ${userId}, message: ${message}`);

            const replyText = await this.webhookService.handleNurseMessage(message, userId);

            this.logger.log(`[REPLY] userId: ${userId}, response: ${replyText}`);

            await this.client.replyMessage({
              replyToken: event.replyToken,
              messages: [{ type: 'text', text: replyText }],
            });
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
