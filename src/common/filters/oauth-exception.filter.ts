import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { type Response } from 'express';
import { VaultService } from 'src/vault/vault.service';

@Catch()
export class OauthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OauthExceptionFilter.name);

  constructor(private readonly vault: VaultService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    this.logger.warn(
      `Oauth flow failed: ${exception instanceof Error ? exception.message : String(exception)}`,
    );
    const redirectUrl = new URL(this.vault.app.frontend_url);
    redirectUrl.searchParams.set('error', 'oauth_failed');
    response.redirect(redirectUrl.toString());
  }
}
