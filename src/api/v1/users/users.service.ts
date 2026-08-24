// src/api/v1/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { publicMedia } from '../common/media';
import {
  ApiUserPageSchema,
  ApiUserSchema,
  type ApiUserDTO,
  type ApiUserPageDTO,
} from '../common/schemas/api-users.schema';
import {
  skipFor,
  type ApiPageQueryDTO,
} from '../common/schemas/api-pagination.schema';

const LIST_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  score: true,
} as const;

const DETAIL_SELECT = {
  username: true,
  bio: true,
  avatarUrl: true,
  score: true,
} as const;

/**
 * Only accounts that agreed to be listed are visible here: soft deleted and
 * private ones are filtered on every query, so a private profile answers 404
 * rather than telling a stranger it exists.
 */
const VISIBLE = { deletedAt: null, visibility: { not: 'private' } } as const;

@Injectable()
export class ApiUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllUsers(query: ApiPageQueryDTO): Promise<ApiUserPageDTO> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: VISIBLE,
        select: LIST_SELECT,
        orderBy: { id: 'asc' },
        skip: skipFor(query),
        take: query.limit,
      }),
      this.prisma.user.count({ where: VISIBLE }),
    ]);

    return ApiUserPageSchema.parse({
      data: rows.map((row) => ({
        ...row,
        avatarUrl: publicMedia(row.avatarUrl),
      })),
      page: query.page,
      limit: query.limit,
      total,
    });
  }

  /**
   * The three counters are derived, never stored. They are counted in one
   * transaction with the profile read so a room closed mid-flight cannot be
   * reported by one query and not the other.
   */
  async findOneUser(id: number): Promise<ApiUserDTO> {
    const user = await this.prisma.user.findFirst({
      where: { id, ...VISIBLE },
      select: DETAIL_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [pearsPals, activeRooms, pollsCreated] =
      await this.prisma.$transaction([
        this.prisma.friendship.count({
          where: {
            status: 'accepted',
            deletedAt: null,
            OR: [{ userAId: id }, { userBId: id }],
          },
        }),
        this.prisma.roomMember.count({
          where: {
            userId: id,
            deletedAt: null,
            room: { status: 'active', deletedAt: null },
          },
        }),
        this.prisma.poll.count({
          where: { createdById: id, deletedAt: null },
        }),
      ]);

    return ApiUserSchema.parse({
      ...user,
      avatarUrl: publicMedia(user.avatarUrl),
      pearsPals,
      activeRooms,
      pollsCreated,
    });
  }
}
