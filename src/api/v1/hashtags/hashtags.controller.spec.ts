import { Test, TestingModule } from '@nestjs/testing';
import { ApiHashtagsController } from './hashtags.controller';
import { ApiHashtagsService } from './hashtags.service';

describe('ApiHashtagsController', () => {
  let controller: ApiHashtagsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiHashtagsController],
      providers: [ApiHashtagsService],
    }).compile();

    controller = module.get<ApiHashtagsController>(ApiHashtagsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
