import { Test, TestingModule } from '@nestjs/testing';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';
import { usersServiceMock } from 'src/users/users.service.mock';
import { fileUploadServiceMock } from 'src/file-upload/file-upload.service.mock';
import { storageServiceMock } from 'src/storage/storage.service.mock';

describe('MeController', () => {
  let controller: MeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        MeService,
        prismaMock,
        usersServiceMock,
        fileUploadServiceMock,
        storageServiceMock,
      ],
    }).compile();

    controller = module.get<MeController>(MeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
