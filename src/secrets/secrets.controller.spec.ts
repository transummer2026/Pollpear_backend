import { Test, TestingModule } from '@nestjs/testing';
import { SecretsController } from './secrets.controller';
import { SecretsService } from './secrets.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('SecretsController', () => {
  let controller: SecretsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecretsController],
      providers: [SecretsService, prismaMock],
    }).compile();

    controller = module.get<SecretsController>(SecretsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
