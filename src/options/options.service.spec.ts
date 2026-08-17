import { PrismaService } from 'src/prisma/prisma.service';
import { OptionsService } from './options.service';

describe('OptionsService', () => {
  const optionFindMany = jest.fn();
  const prisma = {
    option: { findMany: optionFindMany },
  } as unknown as PrismaService;
  const service = new OptionsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildOptionsNestedWrite', () => {
    it('returns undefined and leaves stored options alone when the field is absent', async () => {
      await expect(
        service.buildOptionsNestedWrite(5, undefined),
      ).resolves.toBeUndefined();

      expect(optionFindMany).not.toHaveBeenCalled();
    });

    it('soft-deletes every stored option when the field is sent empty', async () => {
      optionFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const write = await service.buildOptionsNestedWrite(5, []);

      expect(write).toEqual({
        updateMany: [
          { where: { id: 1 }, data: { deletedAt: expect.any(Date) as Date } },
          { where: { id: 2 }, data: { deletedAt: expect.any(Date) as Date } },
        ],
        create: [],
      });
    });

    it('updates options carrying an id and creates the ones without', async () => {
      optionFindMany.mockResolvedValue([{ id: 9 }]);
      const kept = { id: 3, text: 'Comice', order: 0 };
      const added = { text: 'Conference', order: 1 };

      const write = await service.buildOptionsNestedWrite(5, [kept, added]);

      expect(write).toEqual({
        updateMany: [
          { where: { id: 3 }, data: kept },
          { where: { id: 9 }, data: { deletedAt: expect.any(Date) as Date } },
        ],
        create: [added],
      });
    });

    it('excludes only the kept ids from the soft-delete lookup', async () => {
      optionFindMany.mockResolvedValue([]);

      await service.buildOptionsNestedWrite(5, [
        { id: 3, text: 'Comice', order: 0 },
        { text: 'Conference', order: 1 },
      ]);

      expect(optionFindMany).toHaveBeenCalledWith({
        where: { id: { notIn: [3] }, pollId: 5, deletedAt: null },
        select: { id: true },
      });
    });
  });
});
