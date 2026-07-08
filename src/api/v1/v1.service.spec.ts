import { Test, TestingModule } from '@nestjs/testing';
import { ApiV1Service } from './v1.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiV1Service', () => {
  let service: ApiV1Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiV1Service, prismaMock],
    }).compile();

    service = module.get<ApiV1Service>(ApiV1Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
