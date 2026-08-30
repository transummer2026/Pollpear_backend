import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ZodError } from 'zod';
import { formatZodIssues } from '../format-zod-issues';

/**
 * Catches raw ZodErrors that reach the HTTP pipeline. Input validation
 * (ZodValidationPipe) already turns its own parse failures into 400s, so
 * anything landing here is a `.parse()` on data we produced ourselves — a
 * response payload or an internal read that doesn't match our own schema.
 * That is a server bug, not bad client input, so it surfaces as a logged
 * 500 with a safe generic body instead of an unhandled stack-trace leak.
 */
@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ZodExceptionFilter.name);

  catch(exception: ZodError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    this.logger.error(
      `Outgoing data failed schema validation (${formatZodIssues(exception)})`,
    );
    const httpException: HttpException = new InternalServerErrorException(
      'Internal server error',
    );
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }
}
