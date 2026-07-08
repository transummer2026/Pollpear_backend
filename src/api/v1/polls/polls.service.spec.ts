import { Test, TestingModule } from '@nestjs/testing';
import { ApiPollsService } from './polls.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiPollsService', () => {
  let service: ApiPollsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiPollsService, prismaMock],
    }).compile();

    service = module.get<ApiPollsService>(ApiPollsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
