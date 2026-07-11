// prisma/seed/seed.ts
import { faker } from '@faker-js/faker';
import { hash, argon2id } from 'argon2';
import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  Prisma,
  UserRole,
  Gender,
  UserTheme,
  Visibility,
  RoomStatus,
  PollType,
  PollStatus,
  FriendshipStatus,
} from '../../src/generated/prisma/client.js';

dotenv.config({ path: '../.env' });

const USER_COUNT = 50;
const ROOM_COUNT = 20;
const DEFAULT_PASSWORD = 'Password123!';

const HASHTAG_NAMES = [
  'tech',
  'ai',
  'politics',
  'sport',
  'food',
  'music',
  'gaming',
  'movies',
  'travel',
  'school42',
  'health',
  'science',
  'news',
  'memes',
];
const HIDDEN_HASHTAGS = new Set(['memes', 'news']);

const POLL_TYPE_PLAN: PollType[] = [
  ...Array<PollType>(16).fill(PollType.single_choice),
  ...Array<PollType>(12).fill(PollType.multiple_choice),
  ...Array<PollType>(6).fill(PollType.slider),
  ...Array<PollType>(6).fill(PollType.free_field),
];
const POLL_STATUS_PLAN: PollStatus[] = [
  ...Array<PollStatus>(25).fill(PollStatus.active),
  ...Array<PollStatus>(6).fill(PollStatus.locked),
  ...Array<PollStatus>(6).fill(PollStatus.archived),
  ...Array<PollStatus>(3).fill(PollStatus.draft),
];
const FRIENDSHIP_STATUS_PLAN: FriendshipStatus[] = [
  ...Array<FriendshipStatus>(70).fill(FriendshipStatus.accepted),
  ...Array<FriendshipStatus>(20).fill(FriendshipStatus.pending),
  ...Array<FriendshipStatus>(10).fill(FriendshipStatus.rejected),
];

const SCORE_PER_VOTE = 10;
const SCORE_PER_ROOM = 5;
const SCORE_PER_POLL = 20;
const SLIDER_MIN = 0;
const SLIDER_MAX = 10;
const MEMBERS_MIN = 3;
const MEMBERS_MAX = 12;
const HOT_POLL_COUNT = 4;
const DAY_MS = 86_400_000;

const adapter = new PrismaPg({
  connectionString: process.env.POSTGRES_URL as string,
});
const prisma = new PrismaClient({ adapter });

faker.seed(12345);

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY_MS);
const accountCreatedAt = () =>
  faker.date.between({ from: daysAgo(1460), to: daysAgo(548) });

//Fake users seeding

function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    hashLength: 32,
    timeCost: 3,
    parallelism: 4,
    memoryCost: 2 ** 16,
    type: argon2id,
    secret: Buffer.from(process.env.NESTJS_PEPPER ?? 'fakerpepper'),
  });
}

function buildJojo(i: number, passwordHash: string): Prisma.UserCreateInput {
  return {
    username: 'jojo' + i,
    email: 'jojo' + i + '@pollpear.com',
    birthdate: new Date('1998-12-01'),
    passwordHash,
    createdAt: accountCreatedAt(),
    role: UserRole.admin,
    gender: Gender.female,
    nationality: 'Irland',
    userTheme: UserTheme.dark,
  };
}

function buildHygie(i: number, passwordHash: string): Prisma.UserCreateInput {
  return {
    username: 'hygie' + i,
    email: 'hygie' + i + '@pollpear.com',
    birthdate: new Date('1990-01-01'),
    passwordHash,
    createdAt: accountCreatedAt(),
    role: UserRole.admin,
    gender: Gender.female,
    nationality: 'Swiss',
    userTheme: UserTheme.dark,
  };
}

function buildPieric(i: number, passwordHash: string): Prisma.UserCreateInput {
  return {
    username: 'pieric' + i,
    email: 'pieric' + i + '@pollpear.com',
    birthdate: new Date('1990-01-01'),
    passwordHash,
    createdAt: accountCreatedAt(),
    role: UserRole.admin,
    gender: Gender.other,
    nationality: 'Valais',
    userTheme: UserTheme.dark,
  };
}

function buildRaph(i: number, passwordHash: string): Prisma.UserCreateInput {
  return {
    username: 'raph' + i,
    email: 'raph' + i + '@pollpear.com',
    birthdate: new Date('1990-01-01'),
    passwordHash,
    createdAt: accountCreatedAt(),
    role: UserRole.admin,
    gender: Gender.other,
    nationality: 'Geneve',
    userTheme: UserTheme.dark,
  };
}

function buildUser(i: number, passwordHash: string): Prisma.UserCreateInput {
  return {
    username: 'user' + i,
    email: 'user' + i + '@pollpear.com',
    birthdate: faker.date.birthdate({ min: 18, max: 90, mode: 'age' }),
    passwordHash,
    createdAt: accountCreatedAt(),
    role: UserRole.user,
    gender: faker.helpers.arrayElement([
      Gender.male,
      Gender.female,
      Gender.other,
      Gender.prefer_not_to_say,
    ]),
    nationality: faker.location.country(),
    userTheme: faker.helpers.arrayElement([
      UserTheme.light,
      UserTheme.dark,
      UserTheme.system,
      UserTheme.other,
    ]),
  };
}

function buildModerator(
  i: number,
  passwordHash: string,
): Prisma.UserCreateInput {
  return {
    username: 'moderator' + i,
    email: 'moderator' + i + '@pollpear.com',
    birthdate: faker.date.birthdate({ min: 18, max: 90, mode: 'age' }),
    passwordHash,
    createdAt: accountCreatedAt(),
    role: UserRole.moderator,
    gender: faker.helpers.arrayElement([
      Gender.male,
      Gender.female,
      Gender.other,
      Gender.prefer_not_to_say,
    ]),
    nationality: faker.location.country(),
    userTheme: faker.helpers.arrayElement([
      UserTheme.light,
      UserTheme.dark,
      UserTheme.system,
      UserTheme.other,
    ]),
  };
}

// Fake Rooms seeding

function buildRoom(i: number, creatorId: number): Prisma.RoomCreateInput {
  const status = faker.helpers.arrayElement([
    RoomStatus.active,
    RoomStatus.draft,
    RoomStatus.locked,
    RoomStatus.archived,
  ]);

  const publishedAt =
    status === RoomStatus.draft ? null : faker.date.past({ years: 1 });
  const createdAt = publishedAt
    ? faker.date.recent({ days: 5, refDate: publishedAt })
    : faker.date.recent({ days: 30 });

  return {
    name: 'room' + i,
    description: faker.lorem.sentence(),
    bannerUrl: '/uploads/banners/default.svg',
    visibility: faker.helpers.arrayElement([
      Visibility.public,
      Visibility.private,
    ]),
    status,
    publishedAt,
    createdAt,
    createdBy: { connect: { id: creatorId } },
  };
}

// Fake Polls / Options / Votes seeding

function buildOptionRows(
  type: PollType,
): Prisma.OptionCreateWithoutPollInput[] {
  if (type === PollType.slider) {
    return [
      {
        label: 'scale',
        order: 0,
        sliderLeftLabel: String(SLIDER_MIN),
        sliderRightLabel: String(SLIDER_MAX),
      },
    ];
  }
  if (type === PollType.free_field) {
    return [{ label: 'free_text_answer', order: 0 }];
  }
  const count =
    type === PollType.single_choice
      ? faker.number.int({ min: 2, max: 5 })
      : faker.number.int({ min: 3, max: 6 });
  return Array.from({ length: count }, (_, order) => ({
    label: faker.lorem.words({ min: 1, max: 3 }),
    order,
  }));
}

function buildPollTimes(
  status: PollStatus,
  room: { publishedAt: Date | null; createdAt: Date } | null,
): { createdAt: Date; publishedAt: Date | null; endsAt: Date } {
  if (status === PollStatus.draft) {
    return {
      createdAt: faker.date.recent({ days: 20 }),
      publishedAt: null,
      endsAt: faker.date.future({ years: 1 }),
    };
  }
  const publishedAt = room
    ? faker.date.between({ from: room.publishedAt ?? room.createdAt, to: now })
    : faker.date.past({ years: 1 });
  const createdAt = room
    ? faker.date.between({
        from: new Date(
          Math.max(
            publishedAt.getTime() - 5 * DAY_MS,
            (room.publishedAt ?? room.createdAt).getTime(),
          ),
        ),
        to: publishedAt,
      })
    : faker.date.recent({ days: 5, refDate: publishedAt });
  const endsAt =
    status === PollStatus.active
      ? faker.date.future({ years: 1, refDate: now })
      : faker.date.between({ from: publishedAt, to: now });
  return { createdAt, publishedAt, endsAt };
}

function pickVoteOptions(
  type: PollType,
  liveOptions: { id: number }[],
  voterIndex: number,
  leaderId: number,
): { optionIds: number[]; label: string | null } {
  if (type === PollType.slider) {
    const value = Math.round(
      (faker.number.int({ min: SLIDER_MIN, max: SLIDER_MAX }) +
        faker.number.int({ min: SLIDER_MIN, max: SLIDER_MAX })) /
        2,
    );
    return { optionIds: [liveOptions[0].id], label: String(value) };
  }
  if (type === PollType.free_field) {
    return {
      optionIds: [liveOptions[0].id],
      label: faker.lorem.paragraph().slice(0, 255),
    };
  }
  if (type === PollType.single_choice) {
    const leader = liveOptions.find((o) => o.id === leaderId) ?? liveOptions[0];
    const chosen =
      voterIndex < liveOptions.length
        ? liveOptions[voterIndex]
        : faker.helpers.arrayElement([leader, ...liveOptions]);
    return { optionIds: [chosen.id], label: null };
  }
  const subset = faker.helpers.arrayElements(
    liveOptions,
    faker.number.int({ min: 1, max: Math.min(3, liveOptions.length) }),
  );
  if (
    voterIndex < liveOptions.length &&
    !subset.some((o) => o.id === liveOptions[voterIndex].id)
  ) {
    subset[0] = liveOptions[voterIndex];
  }
  return { optionIds: subset.map((o) => o.id), label: null };
}

async function main() {
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  await prisma.user.create({ data: buildJojo(0, passwordHash) });
  await prisma.user.create({ data: buildHygie(1, passwordHash) });
  await prisma.user.create({ data: buildPieric(2, passwordHash) });
  await prisma.user.create({ data: buildRaph(3, passwordHash) });
  await prisma.user.create({ data: buildModerator(4, passwordHash) });
  await prisma.user.create({ data: buildUser(5, passwordHash) });

  for (let i = 6; i < USER_COUNT; i++) {
    await prisma.user.create({ data: buildUser(i, passwordHash) });
  }
  console.log(`Done — ${USER_COUNT} users seeded.`);

  const userIds = (await prisma.user.findMany({ select: { id: true } })).map(
    (u) => u.id,
  );
  for (let i = 0; i < ROOM_COUNT; i++) {
    const creatorId = faker.helpers.arrayElement(userIds);
    await prisma.room.create({ data: buildRoom(i, creatorId) });
  }
  console.log(`Done — ${ROOM_COUNT} rooms seeded.`);

  const bump = (m: Map<number, number>, id: number) =>
    m.set(id, (m.get(id) ?? 0) + 1);
  const votesCast = new Map<number, number>();
  const roomsJoined = new Map<number, number>();
  const pollsCreated = new Map<number, number>();

  const rooms = await prisma.room.findMany({
    select: {
      id: true,
      status: true,
      visibility: true,
      publishedAt: true,
      createdById: true,
      createdAt: true,
    },
  });

  const hashtagIds = new Map<string, number>();
  for (const name of HASHTAG_NAMES) {
    const hashtag = await prisma.hashtag.create({
      data: { name, isVisible: !HIDDEN_HASHTAGS.has(name) },
    });
    hashtagIds.set(name, hashtag.id);
  }

  const roomMembers = new Map<number, { userId: number; joinedAt: Date }[]>();
  const roomMemberRows: { roomId: number; userId: number; joinedAt: Date }[] =
    [];
  for (const room of rooms) {
    const base = room.publishedAt ?? room.createdAt;
    const members = [{ userId: room.createdById, joinedAt: base }];
    if (room.status !== RoomStatus.draft) {
      const pool = userIds.filter((id) => id !== room.createdById);
      const extraCount = Math.min(
        faker.number.int({ min: MEMBERS_MIN, max: MEMBERS_MAX }),
        pool.length,
      );
      for (const uid of faker.helpers.arrayElements(pool, extraCount)) {
        members.push({
          userId: uid,
          joinedAt: faker.date.between({ from: base, to: now }),
        });
      }
    }
    roomMembers.set(room.id, members);
    for (const member of members) {
      roomMemberRows.push({
        roomId: room.id,
        userId: member.userId,
        joinedAt: member.joinedAt,
      });
      bump(roomsJoined, member.userId);
    }
  }
  await prisma.roomMember.createMany({ data: roomMemberRows });

  const friendshipStatuses = faker.helpers.shuffle(FRIENDSHIP_STATUS_PLAN);
  const usedPairs = new Set<string>();
  const friendshipRows: {
    status: FriendshipStatus;
    requesterId: number;
    addresseeId: number;
  }[] = [];
  while (friendshipRows.length < friendshipStatuses.length) {
    const [a, b] = faker.helpers.arrayElements(userIds, 2);
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (usedPairs.has(key)) continue;
    usedPairs.add(key);
    const requesterId = faker.datatype.boolean() ? a : b;
    friendshipRows.push({
      status: friendshipStatuses[friendshipRows.length],
      requesterId,
      addresseeId: requesterId === a ? b : a,
    });
  }
  await prisma.friendship.createMany({ data: friendshipRows });

  const pollTypes = faker.helpers.shuffle(POLL_TYPE_PLAN);
  const pollStatuses = faker.helpers.shuffle(POLL_STATUS_PLAN);
  const activeRooms = rooms.filter((r) => r.status === RoomStatus.active);
  const pollRecords: {
    id: number;
    type: PollType;
    status: PollStatus;
    publishedAt: Date | null;
    endsAt: Date;
    roomId: number | null;
    visibility: Visibility;
    createdById: number;
    options: { id: number; isDeleted: boolean }[];
  }[] = [];
  let roomCursor = 0;
  let deletedDemoLeft = 2;

  for (let i = 0; i < pollTypes.length; i++) {
    const type = pollTypes[i];
    const status = pollStatuses[i];
    const room =
      status !== PollStatus.draft && activeRooms.length > 0 && i % 2 === 0
        ? activeRooms[roomCursor++ % activeRooms.length]
        : null;
    const visibility = room ? room.visibility : Visibility.public;
    const createdById = room
      ? faker.helpers.arrayElement(roomMembers.get(room.id)!).userId
      : faker.helpers.arrayElement(userIds);

    const { createdAt, publishedAt, endsAt } = buildPollTimes(status, room);
    const optionRows = buildOptionRows(type);
    if (
      deletedDemoLeft > 0 &&
      (type === PollType.single_choice || type === PollType.multiple_choice)
    ) {
      optionRows.push({
        label: '[deleted option]',
        order: optionRows.length,
        isDeleted: true,
      });
      deletedDemoLeft--;
    }

    const poll = await prisma.poll.create({
      data: {
        title: faker.lorem.sentence().replace(/\.$/, '?'),
        description: faker.datatype.boolean() ? faker.lorem.sentence() : null,
        type,
        status,
        visibility,
        isAnonymous: faker.datatype.boolean(),
        allowChangeVote: faker.datatype.boolean(),
        createdAt,
        publishedAt,
        endsAt,
        createdBy: { connect: { id: createdById } },
        ...(room ? { room: { connect: { id: room.id } } } : {}),
        options: { create: optionRows },
      },
      include: { options: true },
    });
    if (status !== PollStatus.draft) bump(pollsCreated, createdById);
    pollRecords.push({
      id: poll.id,
      type,
      status,
      publishedAt,
      endsAt,
      roomId: room?.id ?? null,
      visibility,
      createdById,
      options: poll.options.map((o) => ({ id: o.id, isDeleted: o.isDeleted })),
    });
  }

  const pollHashtagRows: { pollId: number; hashtagId: number }[] = [];
  for (const poll of pollRecords) {
    if (poll.status === PollStatus.draft) continue;
    const isPublic = poll.visibility === Visibility.public;
    if (!isPublic && !faker.datatype.boolean()) continue;
    const names = faker.helpers.arrayElements(
      HASHTAG_NAMES,
      isPublic ? faker.number.int({ min: 1, max: 3 }) : 1,
    );
    for (const name of names) {
      pollHashtagRows.push({
        pollId: poll.id,
        hashtagId: hashtagIds.get(name)!,
      });
    }
  }
  await prisma.pollHashtag.createMany({ data: pollHashtagRows });

  const votablePolls = pollRecords.filter((p) => p.status !== PollStatus.draft);
  const hotPollIds = new Set(
    faker.helpers.arrayElements(
      votablePolls.map((p) => p.id),
      Math.min(HOT_POLL_COUNT, votablePolls.length),
    ),
  );
  for (const poll of votablePolls) {
    const liveOptions = poll.options.filter((o) => !o.isDeleted);
    const leaderId = faker.helpers.arrayElement(liveOptions).id;
    const eligible: { userId: number; joinedAt: Date | null }[] =
      poll.roomId !== null
        ? (roomMembers.get(poll.roomId) ?? []).filter(
            (m) => m.userId !== poll.createdById && m.joinedAt <= poll.endsAt,
          )
        : userIds
            .filter((id) => id !== poll.createdById)
            .map((id) => ({ userId: id, joinedAt: null }));
    if (eligible.length === 0) continue;

    const desired = hotPollIds.has(poll.id)
      ? eligible.length
      : faker.number.int({ min: 1, max: 20 });
    const voters = faker.helpers.arrayElements(
      eligible,
      Math.min(desired, eligible.length),
    );

    for (let vi = 0; vi < voters.length; vi++) {
      const voter = voters[vi];
      const { optionIds, label } = pickVoteOptions(
        poll.type,
        liveOptions,
        vi,
        leaderId,
      );
      const from = new Date(
        Math.max(poll.publishedAt!.getTime(), voter.joinedAt?.getTime() ?? 0),
      );
      const to = new Date(Math.min(poll.endsAt.getTime(), now.getTime()));
      const createdAt = faker.date.between({ from, to });
      await prisma.vote.create({
        data: {
          createdBy: { connect: { id: voter.userId } },
          label,
          createdAt,
          voteOptions: {
            create: optionIds.map((id) => ({ option: { connect: { id } } })),
          },
        },
      });
      bump(votesCast, voter.userId);
    }
  }

  for (const id of userIds) {
    const score =
      SCORE_PER_VOTE * (votesCast.get(id) ?? 0) +
      SCORE_PER_ROOM * (roomsJoined.get(id) ?? 0) +
      SCORE_PER_POLL * (pollsCreated.get(id) ?? 0);
    if (score > 0) await prisma.user.update({ where: { id }, data: { score } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
