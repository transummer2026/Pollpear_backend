import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Le seul test qui monte l'application entiere. Il ne verifie pas ce que
 * repond une route mais que le demarrage tient : AppModule s'assemble, vault
 * repond, et les trois guards globaux sont bien en place.
 *
 * /health est choisie parce qu'elle est la seule route publique : un 200
 * prouve que l'application sert, sans mettre en jeu ni cle ni politique. La
 * seconde assertion est celle qui compte vraiment - une application qui
 * demarre en ayant perdu ses guards repondrait 200 partout, et le premier
 * test ne le verrait pas.
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
