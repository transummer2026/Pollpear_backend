import { Test, TestingModule } from '@nestjs/testing';
import { MeService } from './me.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('MeService', () => {
  let service: MeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MeService, prismaMock],
    }).compile();

    service = module.get<MeService>(MeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
