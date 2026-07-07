import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchService, prismaMock],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
