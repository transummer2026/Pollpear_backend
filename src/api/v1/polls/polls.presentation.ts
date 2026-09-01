import { subject } from '@casl/ability';
import type { Poll, Prisma } from 'src/generated/prisma/client';
import type { Viewer } from '../common/viewer';
import type { ApiPollQueryDTO } from '../common/schemas/api-polls.schema';

const SOMEONE_ELSES_POLL = subject('Poll', {
  deletedAt: null,
  status: 'active',
  createdById: -1,
} as Poll);

function moderatesPolls(viewer: Viewer): boolean {
  return viewer.ability.can('delete', SOMEONE_ELSES_POLL);
}

export function matching(filter: ApiPollQueryDTO): Prisma.PollWhereInput {
  return {
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.createdBy
      ? { createdById: filter.createdBy, isAnonymous: false }
      : {}),
    ...(filter.hashtag
      ? {
          pollHashtags: {
            some: { hashtag: { name: filter.hashtag, deletedAt: null } },
          },
        }
      : {}),
  };
}

export function authorOnFeed<
  Poll extends {
    isAnonymous: boolean;
    createdBy: { id: number; username: string };
  },
>(poll: Poll) {
  return poll.isAnonymous ? null : poll.createdBy;
}

export function authorOf<
  Poll extends {
    isAnonymous: boolean;
    createdBy: { id: number; username: string };
  },
>(poll: Poll, viewer: Viewer) {
  const isOwnPoll = poll.createdBy.id === viewer.id;
  const staysHidden = poll.isAnonymous && !isOwnPoll && !moderatesPolls(viewer);

  return staysHidden ? null : poll.createdBy;
}
