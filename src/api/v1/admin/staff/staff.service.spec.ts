import { Test, TestingModule } from '@nestjs/testing';
import { ApiAdminStaffService } from './staff.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import type { User } from 'src/generated/prisma/client';
import { ApiStaffListItemSchema } from '../../common/schemas/api-admin.schema';

const moderator = { id: 2, role: 'moderator' } as unknown as User;

type StaffQuery = { where: { role: { in: string[] }; deletedAt: null } };

describe('ApiAdminStaffService', () => {
  let service: ApiAdminStaffService;
  const findMany = jest.fn<Promise<unknown>, [StaffQuery]>();
  const count = jest.fn();
  const transaction = jest.fn<Promise<unknown[]>, [unknown[]]>();

  beforeEach(async () => {
    [findMany, count, transaction].forEach((fn) => fn.mockReset());
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiAdminStaffService,
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

    service = module.get<ApiAdminStaffService>(ApiAdminStaffService);
  });

  it('lists staff roles only, and never a deleted one', async () => {
    transaction.mockResolvedValue([[], 0]);

    await service.findStaff({ page: 1, limit: 20 }, moderator);

    expect(findMany.mock.calls[0][0].where).toEqual({
      role: { in: ['admin', 'moderator'] },
      deletedAt: null,
    });
  });

  it('never lists a column the staff contract does not promise', async () => {
    transaction.mockResolvedValue([[], 0]);

    await service.findStaff({ page: 1, limit: 20 }, moderator);

    const { select } = findMany.mock.calls[0][0] as unknown as {
      select: Record<string, true>;
    };
    expect(Object.keys(select).sort()).toEqual(
      Object.keys(ApiStaffListItemSchema.shape).sort(),
    );
  });
});
