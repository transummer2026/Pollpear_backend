import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { type Response } from 'express';

@Catch()
export class OauthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OauthExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    this.logger.warn(
      `Oauth flow failed: ${exception instanceof Error ? exception.message : String(exception)}`,
    );
    const redirectUrl = new URL(
      process.env.FRONTEND_URL ?? 'http://localhost:5173',
    );
    redirectUrl.searchParams.set('error', 'oauth_failed');
    response.redirect(redirectUrl.toString());
  }
}
