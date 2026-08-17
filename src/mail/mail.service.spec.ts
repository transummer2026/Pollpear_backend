import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

describe('MailService', () => {
  const sendMail = jest.fn();
  const service = new MailService({ sendMail } as unknown as MailerService);

  beforeEach(() => jest.clearAllMocks());

  it('sends the password reset template with the reset link and inline logo', async () => {
    await service.sendPasswordResetEmail(
      'user@example.com',
      'https://front.test/reset',
    );

    const [message] = sendMail.mock.calls[0] as [
      {
        to: string;
        subject: string;
        template: string;
        context: Record<string, unknown>;
        attachments: { filename: string; cid: string }[];
      },
    ];
    expect(message).toMatchObject({
      to: 'user@example.com',
      subject: 'Reset your PollPear password',
      template: './password-reset',
    });
    expect(message.context).toMatchObject({
      resetUrl: 'https://front.test/reset',
      expiresIn: '1 hour',
    });
    expect(message.attachments).toMatchObject([
      { filename: 'logo.png', cid: 'logo' },
    ]);
  });

  it('sends the verification template with the verify link and inline logo', async () => {
    await service.sendVerificationEmail(
      'user@example.com',
      'https://front.test/verify',
    );

    const [message] = sendMail.mock.calls[0] as [
      {
        to: string;
        subject: string;
        template: string;
        context: Record<string, unknown>;
        attachments: { filename: string; cid: string }[];
      },
    ];
    expect(message).toMatchObject({
      to: 'user@example.com',
      subject: 'Confirm your PollPear email address',
      template: './verify-email',
    });
    expect(message.context).toMatchObject({
      verifyUrl: 'https://front.test/verify',
      expiresIn: '24 hours',
    });
    expect(message.attachments).toMatchObject([
      { filename: 'logo.png', cid: 'logo' },
    ]);
  });
});
