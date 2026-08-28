import { ForbiddenError } from '@casl/ability';
import { ApiMeAvatarService } from './avatar.service';
import { AvatarService } from 'src/file-upload/avatar.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import type { User } from 'src/generated/prisma/client';

const OWNER_ID = 1;
const file = { originalname: 'me.png' } as Express.Multer.File;

function makeViewer(overrides: Partial<User> = {}): User {
  return { id: OWNER_ID, role: 'user', deletedAt: null, ...overrides } as User;
}

describe('ApiMeAvatarService', () => {
  let service: ApiMeAvatarService;
  const replace = jest.fn<Promise<unknown>, [number, Express.Multer.File]>();
  const viewer = makeViewer();

  beforeEach(() => {
    replace.mockReset();
    service = new ApiMeAvatarService(
      { replace } as unknown as AvatarService,
      new CaslAbilityFactory(),
    );
  });

  it('answers with the new url only, not the whole profile', async () => {
    replace.mockResolvedValue({
      username: 'pollpear',
      email: 'owner@pollpear.com',
      avatarUrl: 'https://gateway/uploads/avatars/1.webp?v=2',
    });

    await expect(service.replaceAvatar(viewer, file)).resolves.toEqual({
      avatarUrl: 'https://gateway/uploads/avatars/1.webp?v=2',
    });
  });

  it('hands the upload to the shared avatar pipeline untouched', async () => {
    replace.mockResolvedValue({ avatarUrl: 'https://gateway/a.webp' });

    await service.replaceAvatar(viewer, file);

    expect(replace).toHaveBeenCalledWith(OWNER_ID, file);
  });

  it('refuses an upload from an account the policy has closed', async () => {
    const closed = makeViewer({ deletedAt: new Date('2026-02-01') });

    await expect(service.replaceAvatar(closed, file)).rejects.toThrow(
      ForbiddenError,
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
