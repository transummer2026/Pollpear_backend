import { Test, TestingModule } from '@nestjs/testing';
import { ApiRegisterService } from './register.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiRegisterService', () => {
  let service: ApiRegisterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiRegisterService, prismaMock],
    }).compile();

    service = module.get<ApiRegisterService>(ApiRegisterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
