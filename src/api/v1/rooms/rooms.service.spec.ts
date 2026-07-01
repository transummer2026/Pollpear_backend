import { Test, TestingModule } from '@nestjs/testing';
import { ApiRoomsService } from './rooms.service';

describe('ApiRoomsService', () => {
  let service: ApiRoomsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiRoomsService],
    }).compile();

    service = module.get<ApiRoomsService>(ApiRoomsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
