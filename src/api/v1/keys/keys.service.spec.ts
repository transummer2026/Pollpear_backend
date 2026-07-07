import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysService } from './keys.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiKeysService, prismaMock],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
