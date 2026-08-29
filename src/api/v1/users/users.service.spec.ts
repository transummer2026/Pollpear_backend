import { Test, TestingModule } from '@nestjs/testing';
import { ApiUsersService } from './users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import type { User } from 'src/generated/prisma/client';
import { BadRequestException } from '@nestjs/common';
import { ApiUserListColumnsSchema } from '../common/schemas/api-users.schema';
import { LIMIT_BY_ROLE } from '../common/schemas/api-pagination.schema';

const listed = {
  id: 7,
  username: 'pollpear',
  avatarUrl: '/uploads/avatars/default.svg',
  score: 12,
  deletedAt: null,
  bansReceived: [],
  blocksReceived: [],
};

type ListQuery = { where: object; skip: number; take: number; select: object };

const viewer = { id: 1, role: 'user' } as unknown as User;

describe('ApiUsersService', () => {
  let service: ApiUsersService;
  const findMany = jest.fn<Promise<unknown>, [ListQuery]>();
  const count = jest.fn();
  const transaction = jest.fn<Promise<unknown[]>, [unknown[]]>();

  beforeEach(async () => {
    [findMany, count, transaction].forEach((fn) => fn.mockReset());
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiUsersService,
        CaslAbilityFactory,
        {
          provide: PrismaService,
          useValue: {
            user: { findMany, count },
            $transaction: transaction,
          },
        },
      ],
    }).compile();

    service = module.get<ApiUsersService>(ApiUsersService);
  });

  it('wraps the rows in the shared page envelope', async () => {
    transaction.mockResolvedValue([[listed], 41]);

    await expect(
      service.findAllUsers({ page: 2, limit: 20 }, viewer),
    ).resolves.toEqual({
      data: [{ id: 7, username: 'pollpear', avatarUrl: null, score: 12 }],
      page: 2,
      limit: 20,
      total: 41,
    });
  });

  /**
   * La portee n'est pas ecrite ici, elle est demandee a la politique: ce test
   * compare la clause envoyee a prisma a celle que produit accessibleBy, donc
   * une regle qui bouge dans casl bouge ici sans que personne edite ce fichier.
   */
  it('scopes the list to what the User policy allows', async () => {
    transaction.mockResolvedValue([[], 0]);

    await service.findAllUsers({ page: 1, limit: 20 }, viewer);

    const { where, skip, take } = findMany.mock.calls[0][0];
    expect(where).toEqual(
      accessibleBy(
        new CaslAbilityFactory().createForUser(viewer),
        'read',
      ).ofType('User'),
    );
    expect({ skip, take }).toEqual({ skip: 0, take: 20 });
  });

  it('never writes the soft delete or the visibility filter by hand', async () => {
    transaction.mockResolvedValue([[], 0]);

    await service.findAllUsers({ page: 1, limit: 20 }, viewer);

    const { where } = findMany.mock.calls[0][0];
    expect(where).not.toHaveProperty('deletedAt');
    expect(where).not.toHaveProperty('visibility');
    expect(JSON.stringify(where)).toContain('deletedAt');
  });

  it('translates page and limit into a skip', async () => {
    transaction.mockResolvedValue([[], 100]);

    await service.findAllUsers({ page: 3, limit: 15 }, viewer);

    const { skip, take } = findMany.mock.calls[0][0];
    expect({ skip, take }).toEqual({ skip: 30, take: 15 });
  });

  it('never lists a column the contract does not promise', async () => {
    transaction.mockResolvedValue([[], 0]);
    await service.findAllUsers({ page: 1, limit: 20 }, viewer);

    const { select } = findMany.mock.calls[0][0];
    expect(Object.keys(select).sort()).toEqual(
      [...Object.keys(ApiUserListColumnsSchema.shape), 'blocksReceived'].sort(),
    );
  });

  it('refuses a page larger than the role allows, instead of trimming it', async () => {
    transaction.mockResolvedValue([[], 500]);

    await expect(
      service.findAllUsers({ page: 1, limit: LIMIT_BY_ROLE.user + 1 }, viewer),
    ).rejects.toThrow(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('lets a moderator key ask for more than a plain user can', async () => {
    transaction.mockResolvedValue([[], 500]);

    await expect(
      service.findAllUsers({ page: 1, limit: LIMIT_BY_ROLE.moderator }, {
        id: 2,
        role: 'moderator',
      } as unknown as User),
    ).resolves.toEqual(expect.objectContaining({ limit: 100 }));
  });

  it('refuses a page past the last one', async () => {
    transaction.mockResolvedValue([[], 30]);

    await expect(
      service.findAllUsers({ page: 4, limit: 20 }, viewer),
    ).rejects.toThrow(BadRequestException);
  });

  it('answers the first page even when the list is empty', async () => {
    transaction.mockResolvedValue([[], 0]);

    await expect(
      service.findAllUsers({ page: 1, limit: 20 }, viewer),
    ).resolves.toEqual(expect.objectContaining({ total: 0, data: [] }));
  });
});
