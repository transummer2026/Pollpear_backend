import { Test, TestingModule } from '@nestjs/testing';
import { ApiHashtagsService } from './hashtags.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiHashtagsService', () => {
  let service: ApiHashtagsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiHashtagsService, prismaMock],
    }).compile();

    service = module.get<ApiHashtagsService>(ApiHashtagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
