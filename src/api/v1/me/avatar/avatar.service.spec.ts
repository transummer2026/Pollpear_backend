import { Test, TestingModule } from '@nestjs/testing';
import { ApiMeAvatarService } from './avatar.service';
import { AvatarService } from 'src/file-upload/avatar.service';

const OWNER_ID = 1;
const file = { originalname: 'me.png' } as Express.Multer.File;

describe('ApiMeAvatarService', () => {
  let service: ApiMeAvatarService;
  const replace = jest.fn<Promise<unknown>, [number, Express.Multer.File]>();

  beforeEach(async () => {
    replace.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiMeAvatarService,
        { provide: AvatarService, useValue: { replace } },
      ],
    }).compile();

    service = module.get<ApiMeAvatarService>(ApiMeAvatarService);
  });

  it('answers with the new url only, not the whole profile', async () => {
    replace.mockResolvedValue({
      username: 'pollpear',
      email: 'owner@pollpear.com',
      avatarUrl: 'https://gateway/uploads/avatars/1.webp?v=2',
    });

    await expect(service.replaceAvatar(OWNER_ID, file)).resolves.toEqual({
      avatarUrl: 'https://gateway/uploads/avatars/1.webp?v=2',
    });
  });

  it('hands the upload to the shared avatar pipeline untouched', async () => {
    replace.mockResolvedValue({ avatarUrl: 'https://gateway/a.webp' });

    await service.replaceAvatar(OWNER_ID, file);

    expect(replace).toHaveBeenCalledWith(OWNER_ID, file);
  });
});
