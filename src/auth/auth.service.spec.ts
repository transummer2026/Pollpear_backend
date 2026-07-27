import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';
import { usersServiceMock } from 'src/users/users.service.mock';
import { redisServiceMock } from 'src/redis/redis.service.mock';
import { vaultServiceMock } from 'src/vault/vault.service.mock';
import { mailServiceMock } from 'src/mail/mail.service.mock';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        prismaMock,
        usersServiceMock,
        redisServiceMock,
        vaultServiceMock,
        mailServiceMock,
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
