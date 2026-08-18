import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ApiUsersService } from './users.service';
import { PrismaService } from 'src/prisma/prisma.service';

const listed = {
  id: 7,
  username: 'pollpear',
  avatarUrl: '/uploads/avatars/default.svg',
  score: 12,
};

const profile = {
  username: 'pollpear',
  bio: null,
  avatarUrl: 'https://cdn.pollpear.com/uploads/avatars/7.webp?v=3',
  score: 12,
};

type ListQuery = { where: object; skip: number; take: number };

describe('ApiUsersService', () => {
  let service: ApiUsersService;
  const findMany = jest.fn<Promise<unknown>, [ListQuery]>();
  const count = jest.fn();
  const findFirst = jest.fn<Promise<unknown>, [{ where: object }]>();
  const transaction = jest.fn<Promise<unknown[]>, [unknown[]]>();

  beforeEach(async () => {
    [findMany, count, findFirst, transaction].forEach((fn) => fn.mockReset());
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiUsersService,
        {
          provide: PrismaService,
          useValue: {
            user: { findMany, count, findFirst },
            friendship: { count: jest.fn() },
            roomMember: { count: jest.fn() },
            poll: { count: jest.fn() },
            $transaction: transaction,
          },
        },
      ],
    }).compile();

    service = module.get<ApiUsersService>(ApiUsersService);
  });

  it('wraps the rows in the shared page envelope', async () => {
    transaction.mockResolvedValue([[listed], 1]);

    await expect(service.findAllUsers({ page: 2, limit: 20 })).resolves.toEqual(
      {
        data: [{ ...listed, avatarUrl: null }],
        page: 2,
        limit: 20,
        total: 1,
      },
    );
  });

  it('never lists a deleted or private account', async () => {
    transaction.mockResolvedValue([[], 0]);

    await service.findAllUsers({ page: 1, limit: 20 });

    const { where, skip, take } = findMany.mock.calls[0][0];
    expect(where).toEqual({
      deletedAt: null,
      visibility: { not: 'private' },
    });
    expect({ skip, take }).toEqual({ skip: 0, take: 20 });
  });

  it('translates page and limit into a skip', async () => {
    transaction.mockResolvedValue([[], 0]);

    await service.findAllUsers({ page: 3, limit: 15 });

    const { skip, take } = findMany.mock.calls[0][0];
    expect({ skip, take }).toEqual({ skip: 30, take: 15 });
  });

  it('answers 404 for an account that is not listed', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.findOneUser(7)).rejects.toThrow(NotFoundException);
  });

  it('reports the three counters alongside the profile', async () => {
    findFirst.mockResolvedValue(profile);
    transaction.mockResolvedValue([4, 2, 9]);

    await expect(service.findOneUser(7)).resolves.toEqual({
      ...profile,
      pearsPals: 4,
      activeRooms: 2,
      pollsCreated: 9,
    });
  });

  it('hides a private profile behind the same 404 as a missing one', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.findOneUser(7)).rejects.toThrow(NotFoundException);
    expect(findFirst.mock.calls[0][0].where).toEqual({
      id: 7,
      deletedAt: null,
      visibility: { not: 'private' },
    });
  });
});
