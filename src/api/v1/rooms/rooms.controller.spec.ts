import { Test, TestingModule } from '@nestjs/testing';
import { ApiRoomsController } from './rooms.controller';
import { ApiRoomsService } from './rooms.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiRoomsController', () => {
  let controller: ApiRoomsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiRoomsController],
      providers: [ApiRoomsService, prismaMock],
    }).compile();

    controller = module.get<ApiRoomsController>(ApiRoomsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
