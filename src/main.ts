import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filters';
import cookieParser from 'cookie-parser';

/**
 * NestFactory exposes static methods that allow creating an application
 * instance. The create() method returns the app object, which fulfills
 * the INestApplication interface (provides a set of methods used later).
 * The Express api is used in this case. The methods of app will have
 * methods exclusively available for Express.
 * TODO: create the type submodule git when making the interfaces with front
 * TODO: ?filter[where][name]=John&filter[where][age]=30
 * ?item[]=1&item[]=2
 */
async function bootstrap() {
  // Create the HTTP (Express) application so we can use middleware and CORS
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? ['http://localhost:5173'],
    credentials: true,
  });

  await app.startAllMicroservices();
  await app.listen(process.env.NESTJS_PORT ?? 3000);
}
void bootstrap();
