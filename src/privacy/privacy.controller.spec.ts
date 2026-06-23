import { Test, TestingModule } from '@nestjs/testing';
import { PrivacyController } from './privacy.controller';

describe('PrivacyController', () => {
  let controller: PrivacyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrivacyController],
    }).compile();

    controller = module.get<PrivacyController>(PrivacyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
