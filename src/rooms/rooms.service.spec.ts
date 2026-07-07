import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from './rooms.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('RoomsService', () => {
  let service: RoomsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoomsService, prismaMock],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
