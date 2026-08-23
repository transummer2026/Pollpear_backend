import type { Prisma } from 'src/generated/prisma/client';
import { Visibility } from 'src/generated/prisma/enums';
import type { Viewer } from '../common/viewer';
import { canSeeDeletedPolls, canSeeEveryPoll } from '../common/abilities';
import {
  ApiPollOfferedTypeSchema,
  type ApiPollQueryDTO,
} from '../common/schemas/api-polls.schema';

function readableBy(viewer: Viewer): Prisma.PollWhereInput[] {
  return [
    { visibility: Visibility.public },
    { createdById: viewer.id },
    {
      room: {
        deletedAt: null,
        roomMembers: { some: { userId: viewer.id, deletedAt: null } },
      },
    },
  ];
}

export function visibleTo(viewer: Viewer): Prisma.PollWhereInput {
  return {
    type: { in: ApiPollOfferedTypeSchema.options },
    ...(canSeeDeletedPolls(viewer.ability) ? {} : { deletedAt: null }),
    ...(canSeeEveryPoll(viewer.ability) ? {} : { OR: readableBy(viewer) }),
  };
}

export function matching(filter: ApiPollQueryDTO): Prisma.PollWhereInput {
  return {
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.createdBy ? { createdById: filter.createdBy } : {}),
    ...(filter.hashtag
      ? {
          pollHashtags: {
            some: { hashtag: { name: filter.hashtag, deletedAt: null } },
          },
        }
      : {}),
  };
}

export function authorOf<
  Poll extends {
    isAnonymous: boolean;
    createdBy: { id: number; username: string };
  },
>(poll: Poll, viewer: Viewer) {
  const isOwnPoll = poll.createdBy.id === viewer.id;
  return poll.isAnonymous && !isOwnPoll && !canSeeEveryPoll(viewer.ability)
    ? null
    : poll.createdBy;
}
