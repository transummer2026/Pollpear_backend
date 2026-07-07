import { Test, TestingModule } from '@nestjs/testing';
import { ApiUsersService } from './users.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiUsersService', () => {
  let service: ApiUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiUsersService, prismaMock],
    }).compile();

    service = module.get<ApiUsersService>(ApiUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
