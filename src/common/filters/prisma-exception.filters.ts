import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from 'src/generated/prisma/client';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';

/**
 * Turns the Prisma errors every service can raise into the HTTP answer they
 * mean: a unique constraint is a 409, a missing row a 404, a bad foreign key
 * or an oversized value a 400. Registered globally, so no route has to catch
 * them itself.
 *
 * An unmapped code is logged and answered as a plain 500: the Prisma message
 * names tables and columns, and none of that belongs in a response body.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let httpException: HttpException;

    switch (exception.code) {
      case 'P2000':
        httpException = new BadRequestException('Invalid input data.');
        break;
      case 'P2002':
        httpException = new ConflictException('Resource already exists.');
        break;
      case 'P2003':
        httpException = new BadRequestException('Invalid reference.');
        break;
      case 'P2025':
        httpException = new NotFoundException('Resource not found.');
        break;
      default:
        this.logger.error(
          `Unmapped Prisma error code ${exception.code}`,
          exception,
        );
        httpException = new InternalServerErrorException('Database error');
    }
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }
}
