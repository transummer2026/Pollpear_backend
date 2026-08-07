import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';
import { caslAbilityFactoryMock } from 'src/casl/casl-ability.factory.mock';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, prismaMock, caslAbilityFactoryMock],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
