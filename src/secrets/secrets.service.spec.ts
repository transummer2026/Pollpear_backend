import { Test, TestingModule } from '@nestjs/testing';
import { SecretsService } from './secrets.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('SecretsService', () => {
  let service: SecretsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SecretsService, prismaMock],
    }).compile();

    service = module.get<SecretsService>(SecretsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
