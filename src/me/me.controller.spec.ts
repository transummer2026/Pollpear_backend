import { Test, TestingModule } from '@nestjs/testing';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';
import { usersServiceMock } from 'src/users/users.service.mock';
import { avatarServiceMock } from 'src/file-upload/avatar.service.mock';
import { apiKeyServiceMock } from 'src/api-key/api-key.service.mock';
import { revocationServiceMock } from 'src/revocation/revocation.service.mock';
import { authServiceMock } from 'src/auth/auth.service.mock';
import { invitationServiceMock } from 'src/invitation/invitation.service.mock';

describe('MeController', () => {
  let controller: MeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        MeService,
        prismaMock,
        usersServiceMock,
        avatarServiceMock,
        apiKeyServiceMock,
        revocationServiceMock,
        authServiceMock,
        invitationServiceMock,
      ],
    }).compile();

    controller = module.get<MeController>(MeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
