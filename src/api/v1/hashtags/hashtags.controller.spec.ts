import { Test, TestingModule } from '@nestjs/testing';
import { ApiHashtagsController } from './hashtags.controller';
import { ApiHashtagsService } from './hashtags.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiHashtagsController', () => {
  let controller: ApiHashtagsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiHashtagsController],
      providers: [ApiHashtagsService, prismaMock],
    }).compile();

    controller = module.get<ApiHashtagsController>(ApiHashtagsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
