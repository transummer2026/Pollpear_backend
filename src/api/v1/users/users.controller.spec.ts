import { Test, TestingModule } from '@nestjs/testing';
import { ApiUsersController } from './users.controller';
import { ApiUsersService } from './users.service';
import { prismaMock } from 'src/prisma/prisma.service.mock';

describe('ApiUsersController', () => {
  let controller: ApiUsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiUsersController],
      providers: [ApiUsersService, prismaMock],
    }).compile();

    controller = module.get<ApiUsersController>(ApiUsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
