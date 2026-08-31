import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ApiUsersController } from '../users/users.controller';
import { ApiUsersService } from '../users/users.service';
import { ApiUserProfileController } from '../users/profile/profile.controller';
import { ApiUserProfileService } from '../users/profile/profile.service';
import { ApiMeController } from '../me/me.controller';
import { ApiMeService } from '../me/me.service';
import { ApiMeAvatarController } from '../me/avatar/avatar.controller';
import { ApiMeAvatarService } from '../me/avatar/avatar.service';

/**
 * Les descriptions des reponses 401 et 403 sont du contrat, pas de la
 * decoration: elles disent au porteur d'une cle pourquoi il est refuse.
 * Passer `users` et `profile` sous `ApiGuardDocs()` ne doit donc rien changer
 * au document servi, et la famille `/me` doit garder son texte propre — elle
 * seule n'a pas d'`:id`, donc pas de 404, et le cas « cle valide mais compte
 * supprime » y remonte jusqu'a l'authentification.
 *
 * Le document est construit pour de vrai plutot que lu dans les metadonnees:
 * c'est lui qu'un client telecharge, et lui seul fait foi.
 */
describe('les reponses de garde du document OpenAPI', () => {
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
        ApiUsersController,
        ApiUserProfileController,
        ApiMeController,
        ApiMeAvatarController,
      ],
      providers: [
        { provide: ApiUsersService, useValue: stub },
        { provide: ApiUserProfileService, useValue: stub },
        { provide: ApiMeService, useValue: stub },
        { provide: ApiMeAvatarService, useValue: stub },
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

  describe('les routes que ApiGuardDocs() couvre desormais', () => {
    it.each([
      ['/v1/users', 'get'],
      ['/v1/users/{id}', 'get'],
    ])('%s %s garde le texte generique', (path, method) => {
      expect(describedBy(path, method, '401')).toBe(
        'Missing, expired or revoked api key.',
      );
      expect(describedBy(path, method, '403')).toBe('Banned account.');
    });
  });

  /**
   * Ces textes-la ne sont pas du remplissage: chacun nomme une raison de refus
   * propre a la route. Les remplacer par le texte generique appauvrirait le
   * contrat, donc `/me` reste en dehors de `ApiGuardDocs()`.
   */
  describe('la famille /me garde ses raisons de refus propres', () => {
    it.each([
      ['/v1/me', 'get'],
      ['/v1/me', 'patch'],
      ['/v1/me', 'delete'],
      ['/v1/me/avatar', 'post'],
    ])('%s %s nomme le compte supprime en 401', (path, method) => {
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
    ])(
      '%s %s dit ce que la politique refuse exactement',
      (path, method, text) => {
        expect(describedBy(path, method, '403')).toBe(text);
      },
    );
  });
});
