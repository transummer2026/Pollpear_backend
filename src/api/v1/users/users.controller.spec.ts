import { Test, TestingModule } from '@nestjs/testing';
import { ApiUsersController } from './users.controller';
import { ApiUsersService } from './users.service';

describe('ApiUsersController', () => {
  let controller: ApiUsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiUsersController],
      providers: [ApiUsersService],
    }).compile();

    controller = module.get<ApiUsersController>(ApiUsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
