import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PollUpdateDTO } from 'Pollpear_shared/src/schemas/polls.schema';

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
    options: PollUpdateDTO['options'],
  ) {
    if (options === undefined) return undefined;

    const optionsToUpdate = options.filter(hasId);
    const optionsToCreate = options.filter((option) => option.id === undefined);
    const optionsToDelete = await this.prisma.option.findMany({
      where: {
        id: { notIn: optionsToUpdate.map((option) => option.id) },
        pollId,
      },
      select: { id: true },
    });

    return {
      updateMany: optionsToUpdate.map((option) => ({
        where: { id: option.id },
        data: option,
      })),
      create: optionsToCreate,
      delete: optionsToDelete,
    };
  }
}
