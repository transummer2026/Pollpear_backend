import { Test, TestingModule } from '@nestjs/testing';
import { OauthService } from './oauth.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';
import { usersServiceMock } from 'src/users/users.service.mock';
import { redisServiceMock } from 'src/redis/redis.service.mock';
import { vaultServiceMock } from 'src/vault/vault.service.mock';
import { authServiceMock } from './auth.service.mock';

describe('OauthService', () => {
  let service: OauthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OauthService,
        prismaMock,
        usersServiceMock,
        redisServiceMock,
        vaultServiceMock,
        authServiceMock,
      ],
    }).compile();

    service = module.get<OauthService>(OauthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
