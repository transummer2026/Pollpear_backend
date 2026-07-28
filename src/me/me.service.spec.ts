import { Test, TestingModule } from '@nestjs/testing';
import { MeService } from './me.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';
import { usersServiceMock } from 'src/users/users.service.mock';
import { fileUploadServiceMock } from 'src/file-upload/file-upload.service.mock';
import { storageServiceMock } from 'src/storage/storage.service.mock';

describe('MeService', () => {
  let service: MeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeService,
        prismaMock,
        usersServiceMock,
        fileUploadServiceMock,
        storageServiceMock,
      ],
    }).compile();

    service = module.get<MeService>(MeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
