// src/core/webhook/webhook.controller.ts
import { Controller, Post, Body, Logger, Req, HttpCode } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import type { Request } from 'express';
import * as crypto from 'crypto';
import { WebhookService } from './webhook.service';
import { messagingApi } from '@line/bot-sdk';

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
