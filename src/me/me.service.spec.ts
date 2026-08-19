import { Test, TestingModule } from '@nestjs/testing';
import { MeService } from './me.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';
import { usersServiceMock } from 'src/users/users.service.mock';
import { avatarServiceMock } from 'src/file-upload/avatar.service.mock';
import { apiKeyServiceMock } from 'src/api-key/api-key.service.mock';
import { revocationServiceMock } from 'src/revocation/revocation.service.mock';

describe('MeService', () => {
  let service: MeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeService,
        prismaMock,
        usersServiceMock,
        avatarServiceMock,
        apiKeyServiceMock,
        revocationServiceMock,
      ],
    }).compile();

    service = module.get<MeService>(MeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
