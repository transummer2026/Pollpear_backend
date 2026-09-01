import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * The only test that boots the whole application. It does not check what a
 * route answers but that startup holds: AppModule assembles, vault responds,
 * and the three global guards are in place.
 *
 * /health is used because it is the only public route: a 200 proves the
 * application serves, without involving a key or the policy. The second
 * assertion is the one that really counts — an application that starts having
 * lost its guards would answer 200 everywhere, and the first test would not
 * notice.
 */
describe('Application boot (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the public health route without a key', () =>
    request(app.getHttpServer()).get('/health').expect(200));

  it('still refuses a guarded route to a caller with no key', () =>
    request(app.getHttpServer()).get('/v1/users').expect(401));
});
