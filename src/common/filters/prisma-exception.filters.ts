import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
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
 * Since this will be used for all the error exceptions in our code base,
 * we need to make this generic
 * argum,enthost is to have a link to the request object which calls
 * the excption. // for sneaky hackers
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
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
        httpException = new InternalServerErrorException('Database error');
    }
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }
}
