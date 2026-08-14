import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PollOptionUpdateDTO } from 'Pollpear_shared/src/schemas/option.schema';

function hasId<T extends { id?: number }>(
  option: T,
): option is T & { id: number } {
  return option.id !== undefined;
}

@Injectable()
export class OptionsService {
  constructor(private prisma: PrismaService) {}
  async buildOptionsNestedWrite(
    pollId: number,
    options: PollOptionUpdateDTO[] | undefined,
  ) {
    if (options === undefined) return undefined;

    const optionsToUpdate = options.filter(hasId);
    const optionsToCreate = options.filter((option) => option.id === undefined);
    const optionsToDelete = await this.prisma.option.findMany({
      where: {
        id: { notIn: optionsToUpdate.map((option) => option.id) },
        pollId,
        deletedAt: null,
      },
      select: { id: true },
    });

    return {
      updateMany: [
        ...optionsToUpdate.map((option) => ({
          where: { id: option.id },
          data: option,
        })),
        ...optionsToDelete.map(({ id }) => ({
          where: { id },
          data: { deletedAt: new Date() },
        })),
      ],
      create: optionsToCreate,
    };
  }
}
