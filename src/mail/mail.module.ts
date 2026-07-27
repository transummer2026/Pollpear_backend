import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { VaultService } from 'src/vault/vault.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [VaultService],
      useFactory: (vault: VaultService) => ({
        transport: {
          host: vault.mail.host,
          port: Number(vault.mail.port),
          auth: {
            user: vault.mail.user,
            pass: vault.mail.pass,
          },
        },
        defaults: {
          from: vault.mail.from,
        },
        template: {
          dir: __dirname + '/templates',
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
