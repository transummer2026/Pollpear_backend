import { Test, TestingModule } from '@nestjs/testing';
import { ApiRoomsService } from './rooms.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiRoomsService', () => {
  let service: ApiRoomsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiRoomsService, prismaMock],
    }).compile();

    service = module.get<ApiRoomsService>(ApiRoomsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
