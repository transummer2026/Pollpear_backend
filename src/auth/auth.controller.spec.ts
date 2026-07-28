import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';
import { usersServiceMock } from 'src/users/users.service.mock';
import { redisServiceMock } from 'src/redis/redis.service.mock';
import { vaultServiceMock } from 'src/vault/vault.service.mock';
import { mailServiceMock } from 'src/mail/mail.service.mock';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        prismaMock,
        usersServiceMock,
        redisServiceMock,
        vaultServiceMock,
        mailServiceMock,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
