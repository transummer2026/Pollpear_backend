import { Test, TestingModule } from '@nestjs/testing';
import { ApiUsersController } from './users.controller';
import { ApiUsersService } from './users.service';
import type { User } from 'src/generated/prisma/client';

const viewer = { id: 1, role: 'user' } as unknown as User;

describe('ApiUsersController', () => {
  let controller: ApiUsersController;
  const findAllUsers = jest.fn();

  beforeEach(async () => {
    findAllUsers.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiUsersController],
      providers: [{ provide: ApiUsersService, useValue: { findAllUsers } }],
    }).compile();

    controller = module.get<ApiUsersController>(ApiUsersController);
  });

  it('forwards the validated paging query', () => {
    findAllUsers.mockResolvedValue({ data: [], page: 1, limit: 20, total: 0 });

    void controller.findAllUsers({ page: 1, limit: 20 }, viewer);

    expect(findAllUsers).toHaveBeenCalledWith({ page: 1, limit: 20 }, viewer);
  });
});
