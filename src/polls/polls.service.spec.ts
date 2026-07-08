import { Test, TestingModule } from '@nestjs/testing';
import { PollsService } from './polls.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('PollsService', () => {
  let service: PollsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PollsService, prismaMock],
    }).compile();

    service = module.get<PollsService>(PollsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
