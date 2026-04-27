// src/core/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

function maskEmail(email: string): string {
  return email.replace(/(.{2}).+(@.+)/, '$1***$2');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for others
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private get fromAddress(): string {
    return `"MayWin" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
  }

  /** Send a 6-digit OTP for 2FA login verification */
  async sendOtp(to: string, name: string, otp: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'รหัสยืนยันการเข้าสู่ระบบ MayWin',
        html: `
          <div style="font-family: 'Segoe UI', sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
            <div style="background: white; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <div style="width: 48px; height: 48px; background: #eff6ff; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <span style="font-size: 24px;">🔐</span>
              </div>
              <h2 style="margin: 0 0 8px; font-size: 18px; color: #111827;">รหัสยืนยันของคุณ</h2>
              <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">สวัสดี ${name}, กรุณาใช้รหัสด้านล่างเพื่อเข้าสู่ระบบ</p>
              <div style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #4f46e5; background: #eef2ff; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
                ${otp}
              </div>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">รหัสนี้จะหมดอายุใน <strong>10 นาที</strong> กรุณาอย่าแชร์รหัสนี้กับผู้อื่น</p>
            </div>
          </div>
        `,
      });
      this.logger.log(`[MAIL] OTP sent to ${maskEmail(to)}`);
    } catch (err) {
      this.logger.error(`[MAIL] Failed to send OTP to ${maskEmail(to)}:`, err);
      throw err;
    }
  }

  /** Send welcome email with temporary password when admin creates a nurse account */
  async sendWelcome(to: string, name: string, tempPassword: string): Promise<void> {
    try {
      const loginUrl = process.env.FRONTEND_URL || 'https://your-app.vercel.app/v2/login';
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'ยินดีต้อนรับสู่ MayWin – ข้อมูลบัญชีของคุณ',
        html: `
          <div style="font-family: 'Segoe UI', sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
            <div style="background: white; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <div style="width: 48px; height: 48px; background: #f0fdf4; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <span style="font-size: 24px;">👋</span>
              </div>
              <h2 style="margin: 0 0 8px; font-size: 18px; color: #111827;">ยินดีต้อนรับ, ${name}!</h2>
              <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">บัญชีของคุณในระบบ MayWin ได้รับการสร้างเรียบร้อยแล้ว</p>

              <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">ข้อมูลสำหรับเข้าสู่ระบบ</p>
                <p style="margin: 0 0 4px; font-size: 14px; color: #111827;"><strong>อีเมล:</strong> ${to}</p>
                <p style="margin: 0; font-size: 14px; color: #111827;"><strong>รหัสผ่านชั่วคราว:</strong>
                  <span style="font-family: monospace; background: white; padding: 2px 8px; border-radius: 4px; border: 1px solid #d1d5db;">${tempPassword}</span>
                </p>
              </div>

              <a href="${loginUrl}" style="display: block; background: #4f46e5; color: white; text-align: center; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-bottom: 16px;">
                เข้าสู่ระบบ →
              </a>

              <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                ทุกครั้งที่เข้าสู่ระบบ ระบบจะส่งรหัส OTP ไปยังอีเมลนี้เพื่อยืนยันตัวตน
              </p>
            </div>
          </div>
        `,
      });
      this.logger.log(`[MAIL] Welcome email sent to ${maskEmail(to)}`);
    } catch (err) {
      this.logger.error(`[MAIL] Failed to send welcome email to ${maskEmail(to)}:`, err);
      throw err;
    }
  }
}
