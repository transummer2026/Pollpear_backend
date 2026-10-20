import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, prismaMock],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
