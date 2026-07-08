import { Test, TestingModule } from '@nestjs/testing';
import { ApiService } from './api.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiService', () => {
  let service: ApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiService, prismaMock],
    }).compile();

    service = module.get<ApiService>(ApiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
