import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ApiUserProfileService } from './profile.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import type { User } from 'src/generated/prisma/client';
import { ApiUserColumnsSchema } from '../../common/schemas/api-users.schema';

const profile = {
  id: 7,
  username: 'pollpear',
  bio: null,
  avatarUrl: 'https://cdn.pollpear.com/uploads/avatars/7.webp?v=3',
  score: 12,
};

const counted = {
  ...profile,
  deletedAt: null,
  bansReceived: [],
  blocksReceived: [],
  _count: {
    friendshipsAsUserA: 3,
    friendshipsAsUserB: 1,
    roomMemberships: 2,
    pollsCreated: 9,
  },
};

const viewer = { id: 1, role: 'user' } as unknown as User;

describe('ApiUserProfileService', () => {
  let service: ApiUserProfileService;
  const findFirst = jest.fn<
    Promise<unknown>,
    [{ where: object; select: Record<string, unknown> }]
  >();

  beforeEach(async () => {
    findFirst.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiUserProfileService,
        CaslAbilityFactory,
        {
          provide: PrismaService,
          useValue: { user: { findFirst } },
        },
      ],
    }).compile();

    service = module.get<ApiUserProfileService>(ApiUserProfileService);
  });

  it('reports the three counters alongside the profile', async () => {
    findFirst.mockResolvedValue(counted);

    await expect(service.findOneUser(7, viewer)).resolves.toEqual({
      ...profile,
      pearsPals: 4,
      activeRooms: 2,
      pollsCreated: 9,
    });
  });

  it('counts a friendship from either side of the pair', async () => {
    findFirst.mockResolvedValue({
      ...counted,
      _count: { ...counted._count, friendshipsAsUserA: 0 },
    });

    const user = await service.findOneUser(7, viewer);

    expect(user.pearsPals).toBe(1);
  });

  it('asks postgres for the counters in the profile query itself', async () => {
    findFirst.mockResolvedValue(counted);
    await service.findOneUser(7, viewer);

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0][0].select._count).toEqual({
      select: {
        friendshipsAsUserA: {
          where: { status: 'accepted', deletedAt: null },
        },
        friendshipsAsUserB: { where: { status: 'accepted', deletedAt: null } },
        roomMemberships: {
          where: {
            deletedAt: null,
            room: { status: 'active', deletedAt: null },
          },
        },
        pollsCreated: { where: { deletedAt: null } },
      },
    });
  });

  it('never reads a column the profile does not promise', async () => {
    findFirst.mockResolvedValue(counted);
    await service.findOneUser(7, viewer);

    const { select } = findFirst.mock.calls[0][0];
    expect(Object.keys(select).sort()).toEqual(
      [
        ...Object.keys(ApiUserColumnsSchema.shape),
        'blocksReceived',
        '_count',
      ].sort(),
    );
  });

  it('hides a private profile behind the same 404 as a missing one', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.findOneUser(7, viewer)).rejects.toThrow(
      NotFoundException,
    );
    expect(findFirst.mock.calls[0][0].where).toEqual({
      AND: [
        accessibleBy(
          new CaslAbilityFactory().createForUser(viewer),
          'read',
        ).ofType('User'),
        { id: 7 },
      ],
    });
  });
});
