import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { visibleTo, matching } from '../src/api/v1/polls/polls.visibility';
import { viewerAs } from '../src/api/v1/common/viewer.mock';

/**
 * The poll filter carries a join the user one does not: a poll is visible
 * through the room its author filed it in. Object level tests can only assert
 * the shape of that clause, never that postgres answers what it means, which
 * is what runs here. Same contract as the user suite: TEST_DATABASE_URL or
 * the checks are skipped, and every row written is dropped afterwards.
 */
const url = process.env.TEST_DATABASE_URL;
const describeWithDb = url ? describe : describe.skip;

if (!url) {
  console.warn(
    'TEST_DATABASE_URL is not set: the SQL level poll checks were skipped.',
  );
}

const PREFIX = `ip${Date.now().toString(36)}_`;
const ENDS_AT = new Date(Date.now() + 7 * 24 * 3600 * 1000);

describeWithDb('The poll filter, against postgres', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  const ids: Record<string, number> = {};
  let authorId = 0;
  let memberId = 0;
  let strangerId = 0;
  let roomId = 0;

  const addUser = async (name: string) => {
    const user = await prisma.user.create({
      data: {
        username: `${PREFIX}${name}`,
        email: `${PREFIX}${name}@example.test`,
        birthdate: new Date('1990-01-01'),
        passwordHash: 'not-a-real-hash',
        gender: 'other',
        nationality: 'testland',
      },
      select: { id: true },
    });
    return user.id;
  };

  const addPoll = async (
    key: string,
    over: {
      visibility?: 'private';
      status?: 'active' | 'closed';
      type?: 'free_field';
      roomId?: number;
      deletedAt?: Date;
      createdById?: number;
    } = {},
  ) => {
    const poll = await prisma.poll.create({
      data: {
        title: `${PREFIX}${key}`,
        type: 'single_choice',
        visibility: 'public',
        allowChangeVote: true,
        isAnonymous: false,
        status: 'pending',
        endsAt: ENDS_AT,
        createdById: authorId,
        ...over,
      },
      select: { id: true },
    });
    ids[key] = poll.id;
    return poll.id;
  };

  const seenBy = async (viewer: ReturnType<typeof viewerAs>) => {
    const rows = await prisma.poll.findMany({
      where: {
        AND: [visibleTo(viewer), { title: { startsWith: PREFIX } }],
      },
      select: { title: true },
    });
    return rows.map((row) => row.title.slice(PREFIX.length)).sort();
  };

  beforeAll(async () => {
    authorId = await addUser('author');
    memberId = await addUser('member');
    strangerId = await addUser('stranger');

    const room = await prisma.room.create({
      data: {
        name: `${PREFIX}room`,
        bannerUrl: '/uploads/banners/default.svg',
        visibility: 'private',
        status: 'active',
        createdById: authorId,
      },
      select: { id: true },
    });
    roomId = room.id;

    await prisma.roomMember.createMany({
      data: [
        { roomId, userId: authorId, joinedAt: new Date() },
        { roomId, userId: memberId, joinedAt: new Date() },
      ],
    });

    await addPoll('open');
    await addPoll('closed', { status: 'closed' });
    await addPoll('hidden', { visibility: 'private' });
    await addPoll('inRoom', { visibility: 'private', roomId });
    await addPoll('gone', { deletedAt: new Date() });
    await addPoll('freeform', { type: 'free_field' });
  });

  afterAll(async () => {
    const mine = Object.values(ids);
    await prisma.poll.deleteMany({ where: { id: { in: mine } } });
    await prisma.roomMember.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({
      where: { id: { in: [authorId, memberId, strangerId] } },
    });
    await prisma.$disconnect();
  });

  it('shows a stranger the public polls, whatever their state', async () => {
    expect(await seenBy(viewerAs(strangerId, 'user'))).toEqual([
      'closed',
      'open',
    ]);
  });

  it('keeps a private poll away from a stranger', async () => {
    expect(await seenBy(viewerAs(strangerId, 'user'))).not.toContain('hidden');
  });

  it('shows the author every poll of theirs, private ones included', async () => {
    expect(await seenBy(viewerAs(authorId, 'user'))).toEqual([
      'closed',
      'hidden',
      'inRoom',
      'open',
    ]);
  });

  it('reaches a private poll through the room the caller belongs to', async () => {
    expect(await seenBy(viewerAs(memberId, 'user'))).toContain('inRoom');
  });

  it('does not open that room to somebody who never joined', async () => {
    expect(await seenBy(viewerAs(strangerId, 'user'))).not.toContain('inRoom');
  });

  it('closes the room again once the membership is soft deleted', async () => {
    await prisma.roomMember.updateMany({
      where: { roomId, userId: memberId },
      data: { deletedAt: new Date() },
    });

    const seen = await seenBy(viewerAs(memberId, 'user'));

    await prisma.roomMember.updateMany({
      where: { roomId, userId: memberId },
      data: { deletedAt: null },
    });

    expect(seen).not.toContain('inRoom');
  });

  it('never lists a type the api stopped offering, not even to an admin', async () => {
    for (const role of ['user', 'moderator', 'admin'] as const) {
      expect(await seenBy(viewerAs(strangerId, role))).not.toContain(
        'freeform',
      );
    }
  });

  it('never hands a deleted poll to anybody below admin', async () => {
    for (const role of ['user', 'moderator'] as const) {
      expect(await seenBy(viewerAs(strangerId, role))).not.toContain('gone');
    }
  });

  it('shows a moderator the private polls, still not the deleted ones', async () => {
    const seen = await seenBy(viewerAs(strangerId, 'moderator'));

    expect(seen).toEqual(['closed', 'hidden', 'inRoom', 'open']);
  });

  it('shows an admin everything, deleted included', async () => {
    expect(await seenBy(viewerAs(strangerId, 'admin'))).toEqual([
      'closed',
      'gone',
      'hidden',
      'inRoom',
      'open',
    ]);
  });

  it('narrows on a filter the same way postgres would', async () => {
    const rows = await prisma.poll.findMany({
      where: {
        AND: [
          visibleTo(viewerAs(authorId, 'user')),
          matching({ page: 1, limit: 20, status: 'closed' }),
          { title: { startsWith: PREFIX } },
        ],
      },
      select: { title: true },
    });

    expect(rows.map((row) => row.title.slice(PREFIX.length))).toEqual([
      'closed',
    ]);
  });
});
