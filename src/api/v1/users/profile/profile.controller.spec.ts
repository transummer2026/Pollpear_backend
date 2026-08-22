import { Test, TestingModule } from '@nestjs/testing';
import { ApiUserProfileController } from './profile.controller';
import { ApiUserProfileService } from './profile.service';
import type { User } from 'src/generated/prisma/client';

const viewer = { id: 1, role: 'user' } as unknown as User;

describe('ApiUserProfileController', () => {
  let controller: ApiUserProfileController;
  const findOneUser = jest.fn();

  beforeEach(async () => {
    findOneUser.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiUserProfileController],
      providers: [
        { provide: ApiUserProfileService, useValue: { findOneUser } },
      ],
    }).compile();

    controller = module.get<ApiUserProfileController>(ApiUserProfileController);
  });

  it('forwards the id as a number', () => {
    findOneUser.mockResolvedValue({ username: 'pollpear' });

    void controller.findOneUser(7, viewer);

    expect(findOneUser).toHaveBeenCalledWith(7, viewer);
  });
});
