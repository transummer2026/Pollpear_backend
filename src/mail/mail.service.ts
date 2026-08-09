import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { join } from 'path';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
    expiresIn = '1 hour',
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Reset your PollPear password',
      template: './password-reset',
      context: {
        resetUrl,
        expiresIn,
        year: new Date().getFullYear(),
      },
      attachments: [
        {
          filename: 'logo.png',
          path: join(__dirname, 'assets', 'logo.png'),
          cid: 'logo',
        },
      ],
    });
  }

  async sendVerificationEmail(
    to: string,
    verifyUrl: string,
    expiresIn = '24 hours',
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Confirm your PollPear email address',
      template: './verify-email',
      context: {
        verifyUrl,
        expiresIn,
        year: new Date().getFullYear(),
      },
      attachments: [
        {
          filename: 'logo.png',
          path: join(__dirname, 'assets', 'logo.png'),
          cid: 'logo',
        },
      ],
    });
  }
}
