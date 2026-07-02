import { Test, TestingModule } from '@nestjs/testing';
import { ApiRoomsController } from './rooms.controller';
import { ApiRoomsService } from './rooms.service';

describe('ApiRoomsController', () => {
  let controller: ApiRoomsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiRoomsController],
      providers: [ApiRoomsService],
    }).compile();

    controller = module.get<ApiRoomsController>(ApiRoomsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
