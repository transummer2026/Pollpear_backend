import { Test, TestingModule } from '@nestjs/testing';
import { ApiHashtagsService } from './hashtags.service';

describe('ApiHashtagsService', () => {
  let service: ApiHashtagsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiHashtagsService],
    }).compile();

    service = module.get<ApiHashtagsService>(ApiHashtagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
