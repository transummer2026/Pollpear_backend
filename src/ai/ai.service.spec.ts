import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService, prismaMock],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
