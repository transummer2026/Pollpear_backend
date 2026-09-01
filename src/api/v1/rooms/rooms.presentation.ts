import type { Prisma } from 'src/generated/prisma/client';
import type { ApiRoomQueryDTO } from '../common/schemas/api-rooms.schema';

export function matching(filter: ApiRoomQueryDTO): Prisma.RoomWhereInput {
  return {
    ...(filter.visibility ? { visibility: filter.visibility } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.createdBy ? { createdById: filter.createdBy } : {}),
  };
}
