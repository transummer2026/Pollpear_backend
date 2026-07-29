import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { ForbiddenException } from '@nestjs/common';
import { ForbiddenError } from '@casl/ability';
import { AppAbility } from '../../casl/casl-prisma';

@Catch(ForbiddenError)
export class CaslExceptionFilter implements ExceptionFilter {
  catch(exception: ForbiddenError<AppAbility>, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const httpException: HttpException = new ForbiddenException(
      'Access denied',
    );
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }
}
