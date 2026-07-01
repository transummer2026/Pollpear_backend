import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysController } from './keys.controller';
import { ApiKeysService } from './keys.service';

describe('ApiKeysController', () => {
  let controller: ApiKeysController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeysController],
      providers: [ApiKeysService],
    }).compile();

    controller = module.get<ApiKeysController>(ApiKeysController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
