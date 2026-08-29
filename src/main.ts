import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { Request, Response } from 'express';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filters';
import cookieParser from 'cookie-parser';
import { CaslExceptionFilter } from './common/filters/casl-exception.filters';
import { WebsocketAdapter } from './websocket/websocket.adapter';
import { ApiModule } from './api/api.module';
import { ApiV1Module } from './api/v1/v1.module';
import {
  describeApiV1,
  documentRateLimit,
  OPENAPI_DOCS_PATH,
  OPENAPI_JSON_PATH,
} from './api/v1/common/openapi';

function setupApiDocs(
  app: NestExpressApplication,
  publicUrl: string,
  rateLimit: RateLimitSecrets,
) {
  const document = documentRateLimit(
    SwaggerModule.createDocument(app, describeApiV1(publicUrl), {
      include: [ApiModule, ApiV1Module],
      deepScanRoutes: true,
    }),
    rateLimit,
  );

  app.use(OPENAPI_JSON_PATH, (_req: Request, res: Response) =>
    res.json(document),
  );
  app.use(OPENAPI_DOCS_PATH, apiReference({ content: document }));
}
import { VaultService, type RateLimitSecrets } from './vault/vault.service';

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
  app.set('query parser', 'extended');
  app.use(cookieParser());
  app.useGlobalFilters(new PrismaExceptionFilter(), new CaslExceptionFilter());
  app.useWebSocketAdapter(new WebsocketAdapter(app));
  const vault = app.get(VaultService);
  setupApiDocs(app, vault.app.gateway_url, vault.rateLimit);
  await app.listen(vault.app.backend_port);
}
void bootstrap();
