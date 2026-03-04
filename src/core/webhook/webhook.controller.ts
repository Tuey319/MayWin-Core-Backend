import { Controller, Post, Body, Logger } from '@nestjs/common';
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
  }

  @Post()
  async handleLineWebhook(@Body() body: any) {
    try {
      const events = body.events || [];
      this.logger.debug(`[WEBHOOK] Received ${events.length} events`);

      for (const event of events) {
        try {
          if (event.type === 'message' && event.message.type === 'text') {
            // Get user ID from LINE event
            const userId = event.source.userId || event.source.groupId || 'unknown';
            const message = event.message.text;
            // Print incoming message and userId
            this.logger.log(`[LINE] userId: ${userId}, message: ${message}`);

            // Send the text to the service with user ID for conversation state tracking
            const replyText = await this.webhookService.handleNurseMessage(message, userId);

            // Print Gemini response and userId
            this.logger.log(`[GEMINI] userId: ${userId}, response: ${replyText}`);

            // Reply back to the nurse on LINE
            await this.client.replyMessage({
              replyToken: event.replyToken,
              messages: [{ type: 'text', text: replyText }],
            });
          }
        } catch (error) {
          this.logger.error(`[ERROR] Processing event failed:`, error);
          // Try to send error message back to user
          try {
            await this.client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                {
                  type: 'text',
                  text: '❌ ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้งค่ะ',
                },
              ],
            });
          } catch (replyError) {
            this.logger.error(`[ERROR] Failed to send error reply:`, replyError);
          }
        }
      }
      return { status: 'ok' };
    } catch (error) {
      this.logger.error(`[ERROR] Webhook handler failed:`, error);
      // Still return ok to prevent LINE from retrying
      return { status: 'ok' };
    }
  }
}
