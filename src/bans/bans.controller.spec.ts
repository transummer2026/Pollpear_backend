import { Test, TestingModule } from '@nestjs/testing';
import { BansController } from './bans.controller';

describe('BansController', () => {
  let controller: BansController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BansController],
    }).compile();

    controller = module.get<BansController>(BansController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
