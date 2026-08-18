import { Test, TestingModule } from '@nestjs/testing';
import { ApiUsersController } from './users.controller';
import { ApiUsersService } from './users.service';

describe('ApiUsersController', () => {
  let controller: ApiUsersController;
  const findAllUsers = jest.fn();
  const findOneUser = jest.fn();

  beforeEach(async () => {
    findAllUsers.mockReset();
    findOneUser.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiUsersController],
      providers: [
        { provide: ApiUsersService, useValue: { findAllUsers, findOneUser } },
      ],
    }).compile();

    controller = module.get<ApiUsersController>(ApiUsersController);
  });

  it('forwards the validated paging query', () => {
    findAllUsers.mockResolvedValue({ data: [], page: 1, limit: 20, total: 0 });

    void controller.findAllUsers({ page: 1, limit: 20 });

    expect(findAllUsers).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('forwards the id as a number', () => {
    findOneUser.mockResolvedValue({ username: 'pollpear' });

    void controller.findOneUser(7);

    expect(findOneUser).toHaveBeenCalledWith(7);
  });
});
