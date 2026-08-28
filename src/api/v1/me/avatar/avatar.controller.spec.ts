import { Test, TestingModule } from '@nestjs/testing';
import { ApiMeAvatarController } from './avatar.controller';
import { ApiMeAvatarService } from './avatar.service';
import type { User } from 'src/generated/prisma/client';

const OWNER_ID = 1;
const viewer = { id: OWNER_ID, role: 'user', deletedAt: null } as User;
const file = { originalname: 'me.png' } as Express.Multer.File;

describe('ApiMeAvatarController', () => {
  let controller: ApiMeAvatarController;
  const replaceAvatar = jest.fn();

  beforeEach(async () => {
    replaceAvatar.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiMeAvatarController],
      providers: [{ provide: ApiMeAvatarService, useValue: { replaceAvatar } }],
    }).compile();

    controller = module.get<ApiMeAvatarController>(ApiMeAvatarController);
  });

  it('uploads for the caller, never for an id from the request', () => {
    replaceAvatar.mockResolvedValue({ avatarUrl: 'https://gateway/a.webp' });

    void controller.uploadAvatar(viewer, file);

    expect(replaceAvatar).toHaveBeenCalledWith(viewer, file);
  });
});
