import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ApiV1Controller } from '../v1.controller';
import { ApiV1Service } from '../v1.service';
import { ApiUsersController } from '../users/users.controller';
import { ApiUsersService } from '../users/users.service';
import { ApiUserProfileController } from '../users/profile/profile.controller';
import { ApiUserProfileService } from '../users/profile/profile.service';
import { ApiMeController } from '../me/me.controller';
import { ApiMeService } from '../me/me.service';
import { ApiMeAvatarController } from '../me/avatar/avatar.controller';
import { ApiMeAvatarService } from '../me/avatar/avatar.service';
import { ApiPollsController } from '../polls/polls.controller';
import { ApiPollsService } from '../polls/polls.service';
import { ApiPollVoteController } from '../polls/vote/vote.controller';
import { ApiPollVoteService } from '../polls/vote/vote.service';
import { ApiRoomsController } from '../rooms/rooms.controller';
import { ApiRoomsService } from '../rooms/rooms.service';

/**
 * The 401 and 403 descriptions are contract, not decoration: they tell the
 * bearer of a key why it was turned away. Moving a controller under
 * ApiGuardDocs() must therefore leave the served document untouched, and a
 * route that names its own reason must keep it.
 *
 * The document is built for real rather than read out of the metadata: it is
 * what a client downloads, and it alone is authoritative.
 */
describe('the guard responses of the OpenAPI document', () => {
  let paths: Record<
    string,
    Record<string, { responses: Record<string, { description?: string }> }>
  >;

  const describedBy = (path: string, method: string, code: string) =>
    paths[path][method].responses[code].description;

  beforeAll(async () => {
    const stub = {};
    const moduleRef = await Test.createTestingModule({
      controllers: [
        ApiV1Controller,
        ApiUsersController,
        ApiUserProfileController,
        ApiMeController,
        ApiMeAvatarController,
        ApiPollsController,
        ApiPollVoteController,
        ApiRoomsController,
      ],
      providers: [
        { provide: ApiV1Service, useValue: stub },
        { provide: ApiUsersService, useValue: stub },
        { provide: ApiUserProfileService, useValue: stub },
        { provide: ApiMeService, useValue: stub },
        { provide: ApiMeAvatarService, useValue: stub },
        { provide: ApiPollsService, useValue: stub },
        { provide: ApiPollVoteService, useValue: stub },
        { provide: ApiRoomsService, useValue: stub },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    paths = document.paths as typeof paths;
    await app.close();
  });

  describe('the routes ApiGuardDocs() covers', () => {
    it.each([
      ['/v1', 'get'],
      ['/v1/users', 'get'],
      ['/v1/users/{id}', 'get'],
      ['/v1/polls', 'get'],
      ['/v1/polls/{id}', 'get'],
      ['/v1/polls/{id}/results', 'get'],
      ['/v1/polls/{id}/vote', 'get'],
      ['/v1/polls/{id}/vote', 'patch'],
      ['/v1/polls/{id}/vote', 'delete'],
      ['/v1/rooms', 'get'],
      ['/v1/rooms/{id}', 'get'],
    ])('%s %s keeps the generic text', (path, method) => {
      expect(describedBy(path, method, '401')).toBe(
        'Missing, expired or revoked api key.',
      );
      expect(describedBy(path, method, '403')).toBe('Banned account.');
    });
  });

  /**
   * A route that names what it refuses outranks the class it hangs on. Those
   * texts are the reason ApiGuardDocs() cannot simply be spread everywhere.
   */
  describe('a route that names its own refusal keeps it', () => {
    it.each([
      [
        '/v1/polls',
        'post',
        'Banned account, or a room was named the caller cannot file a poll in.',
      ],
      ['/v1/polls/{id}', 'patch', 'Banned account, or not your poll.'],
      ['/v1/polls/{id}', 'delete', 'Banned account, or not your poll.'],
      [
        '/v1/polls/{id}/vote',
        'post',
        'Banned account, or a poll the caller may not vote in.',
      ],
      ['/v1/rooms/{id}', 'patch', 'Banned account, or not your room.'],
      ['/v1/rooms/{id}', 'delete', 'Banned account, or not your room.'],
    ])('%s %s says exactly what is refused', (path, method, text) => {
      expect(describedBy(path, method, '403')).toBe(text);
      expect(describedBy(path, method, '401')).toBe(
        'Missing, expired or revoked api key.',
      );
    });
  });

  /**
   * These texts are not filler: each names a refusal proper to the route.
   * Replacing them with the generic wording would thin the contract, so /me
   * stays outside ApiGuardDocs().
   */
  describe('the /me family keeps its own reasons for refusing', () => {
    it.each([
      ['/v1/me', 'get'],
      ['/v1/me', 'patch'],
      ['/v1/me', 'delete'],
      ['/v1/me/avatar', 'post'],
    ])('%s %s names the deleted account in its 401', (path, method) => {
      expect(describedBy(path, method, '401')).toBe(
        'Missing, expired or revoked api key, or deleted owner.',
      );
    });

    it.each([
      [
        '/v1/me',
        'get',
        'Banned account, or one the policy no longer lets read itself.',
      ],
      [
        '/v1/me',
        'patch',
        'Banned account, or a field the policy keeps read-only.',
      ],
      [
        '/v1/me',
        'delete',
        'Banned account, or one the policy does not let delete itself.',
      ],
      [
        '/v1/me/avatar',
        'post',
        'Banned account, or one the policy keeps out of its avatar.',
      ],
    ])('%s %s says exactly what the policy refuses', (path, method, text) => {
      expect(describedBy(path, method, '403')).toBe(text);
    });
  });
});
