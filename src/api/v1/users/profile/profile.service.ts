// src/api/v1/users/profile/profile.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { PrismaService } from 'src/prisma/prisma.service';
import type { User } from 'src/generated/prisma/client';
import { selectOf, type AssertColumns } from '../../common/select';
import {
  ApiUserColumnsSchema,
  ApiUserSchema,
  type ApiUserColumnsDTO,
  type ApiUserDTO,
} from '../../common/schemas/api-users.schema';
import { visibleTo, presentUser, VIEWER_SELECT } from '../users.visibility';
import { viewerOf } from '../../common/viewer';

const DETAIL_SELECT = selectOf(ApiUserColumnsSchema);

/**
 * Counted by postgres inside the profile query rather than by three extra
 * round trips: the numbers then come from the same snapshot as the row they
 * describe. A friendship is counted from whichever side the user sits on,
 * hence the two halves added back together.
 */
const COUNTS = {
  friendshipsRequested: { where: { status: 'accepted', deletedAt: null } },
  friendshipsReceived: { where: { status: 'accepted', deletedAt: null } },
  roomMemberships: {
    where: { deletedAt: null, room: { status: 'active', deletedAt: null } },
  },
  pollsCreated: { where: { deletedAt: null } },
} as const;

export const DETAIL_MATCHES_MODEL: AssertColumns<ApiUserColumnsDTO, User> =
  true;

@Injectable()
export class ApiUserProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  async findOneUser(id: number, caller: User): Promise<ApiUserDTO> {
    const viewer = viewerOf(caller, this.abilityFactory.createForUser(caller));

    const user = await this.prisma.user.findFirst({
      where: { id, ...visibleTo(viewer) },
      select: {
        ...DETAIL_SELECT,
        ...VIEWER_SELECT(viewer.id),
        _count: { select: COUNTS },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { _count, ...row } = user;
    return ApiUserSchema.parse({
      ...presentUser(row, viewer),
      pearsPals: _count.friendshipsRequested + _count.friendshipsReceived,
      activeRooms: _count.roomMemberships,
      pollsCreated: _count.pollsCreated,
    });
  }
}
