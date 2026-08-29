// prisma/seed/seed.ts
import { faker } from '@faker-js/faker';
import { hash, argon2id } from 'argon2';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { VaultService } from '../../src/vault/vault.service';
import { canonicalPair } from '../../src/friendship/friendship.pair';
import Redis from 'ioredis';
import { apiKeyCacheKey } from '../../src/redis/redis-keys';
import {
  expiryFromTtl,
  generateApiKey,
  remainingSeconds,
} from '../../src/api-key/api-key.util';
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
  NotificationType,
} from '../../src/generated/prisma/client.js';

dotenv.config({ path: '../.env' });

const USER_COUNT = 50;
const ROOM_COUNT = 20;
const DEFAULT_PASSWORD = 'Password123!';
const API_KEY_LIFETIME_SECONDS = 365 * 24 * 60 * 60;

type IssuedKey = {
  role: UserRole;
  username: string;
  key: string;
  keyHash: string;
  ownerId: number;
  expiredAt: Date;
};

const API_ACCOUNTS: { username: string; role: UserRole }[] = [
  { username: 'apiuser', role: UserRole.user },
  { username: 'apimoderator', role: UserRole.moderator },
  { username: 'apiadmin', role: UserRole.admin },
];
const JOJO_PENDING_REQUESTS = 30;

type CrewName = 'jojo' | 'hygie' | 'pieric' | 'raph';

const CREW_ROOM_PLAN: { members: CrewName[]; visibility: Visibility }[] = [
  {
    members: ['jojo', 'hygie', 'pieric', 'raph'],
    visibility: Visibility.public,
  },
  { members: ['jojo', 'hygie'], visibility: Visibility.private },
  { members: ['raph', 'pieric'], visibility: Visibility.private },
  { members: ['jojo', 'raph', 'pieric'], visibility: Visibility.public },
  { members: ['hygie', 'pieric'], visibility: Visibility.private },
  { members: ['jojo', 'raph'], visibility: Visibility.public },
];

const BUSY_ROOM_MESSAGES = 120;
const ROOM_MESSAGES_MIN = 6;
const ROOM_MESSAGES_MAX = 30;
const CHATTY_ROOM_COUNT = 6;
const DELETED_MESSAGE_DEMO = 3;
const VERIFIED_PROBABILITY = 0.85;
const COMPANY_PROBABILITY = 0.6;
const BIO_PROBABILITY = 0.7;
const PRIVATE_PROFILE_PROBABILITY = 0.2;

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
  ...Array<PollStatus>(32).fill(PollStatus.active),
  ...Array<PollStatus>(8).fill(PollStatus.closed),
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

const vault = new VaultService();
let prisma: PrismaClient;

faker.seed(12345);

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY_MS);
const accountCreatedAt = () =>
  faker.date.between({ from: daysAgo(1460), to: daysAgo(548) });

//Fake users seeding

function hashPassword(plain: string, pepper: string): Promise<string> {
  return hash(plain, {
    hashLength: 32,
    timeCost: 3,
    parallelism: 4,
    memoryCost: 2 ** 16,
    type: argon2id,
    secret: Buffer.from(pepper),
  });
}

function buildProfile() {
  const country = faker.location.country();
  const lastSeenAt = faker.helpers.maybe(
    () => faker.date.recent({ days: 30 }),
    { probability: 0.8 },
  );

  return {
    name: faker.person.firstName(),
    surname: faker.person.lastName(),
    nationality: country,
    country,
    city: faker.location.city(),
    state: faker.location.state(),
    company:
      faker.helpers.maybe(() => faker.company.name(), {
        probability: COMPANY_PROBABILITY,
      }) ?? null,
    bio:
      faker.helpers.maybe(() => faker.person.bio().slice(0, 255), {
        probability: BIO_PROBABILITY,
      }) ?? null,
    isEmailVerified: faker.datatype.boolean({
      probability: VERIFIED_PROBABILITY,
    }),
    visibility: faker.datatype.boolean({
      probability: PRIVATE_PROFILE_PROBABILITY,
    })
      ? Visibility.private
      : Visibility.public,
    lastSeenAt: lastSeenAt ?? null,
  };
}

function buildCrewProfile(
  name: string,
  surname: string,
  place: { nationality: string; country: string; state: string; city: string },
) {
  return {
    name,
    surname,
    ...place,
    company: 'Pollpear',
    bio: faker.person.bio().slice(0, 255),
    isEmailVerified: true,
    visibility: Visibility.public,
    lastSeenAt: faker.date.recent({ days: 3 }),
  };
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
    userTheme: UserTheme.dark,
    ...buildCrewProfile('Joanne', 'Murphy', {
      nationality: 'Irish',
      country: 'Ireland',
      state: 'Leinster',
      city: 'Dublin',
    }),
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
    userTheme: UserTheme.dark,
    ...buildCrewProfile('Hygie', 'Bernard', {
      nationality: 'Swiss',
      country: 'Switzerland',
      state: 'Zürich',
      city: 'Zürich',
    }),
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
    userTheme: UserTheme.dark,
    ...buildCrewProfile('Pieric', 'Emonet', {
      nationality: 'Swiss',
      country: 'Switzerland',
      state: 'Valais',
      city: 'Sion',
    }),
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
    userTheme: UserTheme.dark,
    ...buildCrewProfile('Raphaël', 'Stoll', {
      nationality: 'Swiss',
      country: 'Switzerland',
      state: 'Genève',
      city: 'Genève',
    }),
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
    ...buildProfile(),
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
    ...buildProfile(),
    isEmailVerified: true,
    userTheme: faker.helpers.arrayElement([
      UserTheme.light,
      UserTheme.dark,
      UserTheme.system,
      UserTheme.other,
    ]),
  };
}

// Fake Rooms seeding

function buildRoom(
  i: number,
  creatorId: number,
  plan?: { members: CrewName[]; visibility: Visibility },
): Prisma.RoomCreateInput {
  const status = plan
    ? RoomStatus.active
    : faker.helpers.arrayElement([RoomStatus.active, RoomStatus.closed]);

  const createdAt = faker.date.past({ years: 1 });

  return {
    name: 'room' + i,
    description: faker.lorem.sentence(),
    bannerUrl: '/uploads/banners/default.svg',
    visibility:
      plan?.visibility ??
      faker.helpers.arrayElement([Visibility.public, Visibility.private]),
    status,
    createdAt,
    createdBy: { connect: { id: creatorId } },
  };
}

function buildConversation(
  roomId: number,
  members: { userId: number; joinedAt: Date }[],
  count: number,
  from: Date,
): Prisma.MessageCreateManyInput[] {
  const start = from.getTime();
  const span = Math.max(now.getTime() - start, DAY_MS);

  return Array.from({ length: count }, (_, i) => {
    const at = new Date(
      Math.min(
        start +
          Math.round((span * (i + 1)) / (count + 1)) +
          faker.number.int({ min: 0, max: 60_000 }),
        now.getTime(),
      ),
    );
    const spoken = members.filter((member) => member.joinedAt <= at);
    const author = faker.helpers.arrayElement(
      spoken.length > 0 ? spoken : members,
    );

    return {
      roomId,
      authorId: author.userId,
      content: faker.lorem.sentence({ min: 3, max: 20 }),
      createdAt: at,
    };
  });
}

// Fake Polls / Options / Votes seeding

function buildOptionRows(
  type: PollType,
): Prisma.OptionCreateWithoutPollInput[] {
  if (type === PollType.slider) {
    return [
      {
        text: 'scale',
        order: 0,
        sliderLeftLabel: String(SLIDER_MIN),
        sliderRightLabel: String(SLIDER_MAX),
      },
    ];
  }
  if (type === PollType.free_field) {
    return [{ text: 'free_text_answer', order: 0 }];
  }
  const count =
    type === PollType.single_choice
      ? faker.number.int({ min: 2, max: 5 })
      : faker.number.int({ min: 3, max: 6 });
  return Array.from({ length: count }, (_, order) => ({
    text: faker.lorem.words({ min: 1, max: 3 }),
    order,
  }));
}

function buildPollTimes(
  status: PollStatus,
  room: { createdAt: Date } | null,
): { createdAt: Date; publishedAt: Date | null; endsAt: Date } {
  const publishedAt = room
    ? faker.date.between({ from: room.createdAt, to: now })
    : faker.date.past({ years: 1 });
  const createdAt = room
    ? faker.date.between({
        from: new Date(
          Math.max(
            publishedAt.getTime() - 5 * DAY_MS,
            room.createdAt.getTime(),
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
): { optionIds: number[]; freeField: string | null } {
  if (type === PollType.slider) {
    const value = Math.round(
      (faker.number.int({ min: SLIDER_MIN, max: SLIDER_MAX }) +
        faker.number.int({ min: SLIDER_MIN, max: SLIDER_MAX })) /
        2,
    );
    return { optionIds: [liveOptions[0].id], freeField: String(value) };
  }
  if (type === PollType.free_field) {
    return {
      optionIds: [liveOptions[0].id],
      freeField: faker.lorem.paragraph().slice(0, 255),
    };
  }
  if (type === PollType.single_choice) {
    const leader = liveOptions.find((o) => o.id === leaderId) ?? liveOptions[0];
    const chosen =
      voterIndex < liveOptions.length
        ? liveOptions[voterIndex]
        : faker.helpers.arrayElement([leader, ...liveOptions]);
    return { optionIds: [chosen.id], freeField: null };
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
  return { optionIds: subset.map((o) => o.id), freeField: null };
}

function buildApiAccount(
  username: string,
  role: UserRole,
  passwordHash: string,
): Prisma.UserCreateInput {
  return {
    username,
    email: username + '@pollpear.com',
    birthdate: new Date('1990-01-01'),
    passwordHash,
    createdAt: accountCreatedAt(),
    role,
    gender: Gender.prefer_not_to_say,
    userTheme: UserTheme.dark,
    ...buildProfile(),
    nationality: 'Switzerland',
    country: 'Switzerland',
    state: 'Genève',
    city: 'Genève',
    isEmailVerified: true,
    visibility: Visibility.public,
  };
}

/**
 * La cle en clair n'existe qu'ici : seul son hash est stocke. Elle est donc
 * affichee en fin de seed, sinon elle est perdue. Rien n'est ecrit dans redis,
 * ou la gateway va pourtant la lire : c'est ApiKeySyncService qui l'y restaure
 * au demarrage du backend, ce qui evite de reecrire ici ce format de cle.
 */
async function seedApiAccounts(passwordHash: string): Promise<IssuedKey[]> {
  const issued: IssuedKey[] = [];

  for (const { username, role } of API_ACCOUNTS) {
    const user = await prisma.user.create({
      data: buildApiAccount(username, role, passwordHash),
    });
    const { key, keyHash } = generateApiKey();
    const expiredAt = expiryFromTtl(API_KEY_LIFETIME_SECONDS);

    await prisma.apiKey.create({
      data: { keyHash, appName: 'api-roles', ownerId: user.id, expiredAt },
    });

    issued.push({ role, username, key, keyHash, ownerId: user.id, expiredAt });
  }

  return issued;
}

async function pushKeysToRedis(issued: IssuedKey[]): Promise<number> {
  const redis = new Redis({
    host: vault.redis.host,
    port: Number(vault.redis.port),
    password: vault.redis.password,
  });

  try {
    for (const { keyHash, ownerId, expiredAt } of issued) {
      const ttl = remainingSeconds(expiredAt);
      await redis.set(apiKeyCacheKey(keyHash), ownerId, 'EX', ttl);
    }
    return issued.length;
  } finally {
    await redis.quit();
  }
}

function reportApiAccounts(issued: IssuedKey[]) {
  console.log(`\nAPI test accounts, password ${DEFAULT_PASSWORD}:`);
  for (const { role, username, key } of issued) {
    console.log(`  ${role.padEnd(10)} ${username.padEnd(13)} ${key}`);
  }
  console.log('\nFeed them to scripts/api-roles.sh to compare a route.');
}

async function main() {
  await vault.init();
  const adapter = new PrismaPg({ connectionString: vault.db.database_url });
  prisma = new PrismaClient({ adapter });

  const passwordHash = await hashPassword(
    DEFAULT_PASSWORD,
    vault.session.pepper,
  );

  const jojo = await prisma.user.create({ data: buildJojo(0, passwordHash) });
  const hygie = await prisma.user.create({
    data: buildHygie(1, passwordHash),
  });
  const pieric = await prisma.user.create({
    data: buildPieric(2, passwordHash),
  });
  const raph = await prisma.user.create({ data: buildRaph(3, passwordHash) });
  const crewIds: Record<CrewName, number> = {
    jojo: jojo.id,
    hygie: hygie.id,
    pieric: pieric.id,
    raph: raph.id,
  };
  await prisma.user.create({ data: buildModerator(4, passwordHash) });
  await prisma.user.create({ data: buildUser(5, passwordHash) });

  for (let i = 6; i < USER_COUNT; i++) {
    await prisma.user.create({ data: buildUser(i, passwordHash) });
  }
  const issuedKeys = await seedApiAccounts(passwordHash);
  console.log(
    `Done — ${USER_COUNT} users seeded, plus ${API_ACCOUNTS.length} api ones.`,
  );

  const userIds = (await prisma.user.findMany({ select: { id: true } })).map(
    (u) => u.id,
  );
  const crewRoomMembers = new Map<number, number[]>();
  for (let i = 0; i < ROOM_COUNT; i++) {
    const plan = CREW_ROOM_PLAN[i];
    const creatorId = plan
      ? crewIds[plan.members[0]]
      : faker.helpers.arrayElement(userIds);
    const room = await prisma.room.create({
      data: buildRoom(i, creatorId, plan),
    });
    if (plan) {
      crewRoomMembers.set(
        room.id,
        plan.members.map((member) => crewIds[member]),
      );
    }
  }
  console.log(
    `Done — ${ROOM_COUNT} rooms seeded, ${crewRoomMembers.size} of them shared by the team accounts.`,
  );

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
      createdById: true,
      createdAt: true,
    },
  });

  const hashtagIds = new Map<string, number>();
  for (const name of HASHTAG_NAMES) {
    const hashtag = await prisma.hashtag.create({
      data: {
        name,
        deletedAt: HIDDEN_HASHTAGS.has(name) ? new Date() : null,
      },
    });
    hashtagIds.set(name, hashtag.id);
  }

  const roomMembers = new Map<number, { userId: number; joinedAt: Date }[]>();
  const roomMemberRows: { roomId: number; userId: number; joinedAt: Date }[] =
    [];
  for (const room of rooms) {
    const base = room.createdAt;
    const members = [{ userId: room.createdById, joinedAt: base }];
    for (const crewId of crewRoomMembers.get(room.id) ?? []) {
      if (members.some((member) => member.userId === crewId)) continue;
      members.push({
        userId: crewId,
        joinedAt: faker.date.between({ from: base, to: now }),
      });
    }
    const seated = new Set(members.map((member) => member.userId));
    const pool = userIds.filter((id) => !seated.has(id));
    const extraCount = crewRoomMembers.has(room.id)
      ? 0
      : Math.min(
          faker.number.int({ min: MEMBERS_MIN, max: MEMBERS_MAX }),
          pool.length,
        );
    for (const uid of faker.helpers.arrayElements(pool, extraCount)) {
      members.push({
        userId: uid,
        joinedAt: faker.date.between({ from: base, to: now }),
      });
    }
    members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
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

  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const crewRoomIds = [...crewRoomMembers.keys()];
  const chattyRoomIds = [
    ...crewRoomIds,
    ...faker.helpers.arrayElements(
      rooms.filter((room) => !crewRoomMembers.has(room.id)).map((r) => r.id),
      CHATTY_ROOM_COUNT,
    ),
  ];
  const messageRows: Prisma.MessageCreateManyInput[] = [];
  for (const roomId of chattyRoomIds) {
    const members = roomMembers.get(roomId) ?? [];
    if (members.length === 0) continue;
    const count =
      roomId === crewRoomIds[0]
        ? BUSY_ROOM_MESSAGES
        : faker.number.int({ min: ROOM_MESSAGES_MIN, max: ROOM_MESSAGES_MAX });
    messageRows.push(
      ...buildConversation(
        roomId,
        members,
        count,
        roomById.get(roomId)!.createdAt,
      ),
    );
  }
  for (const row of faker.helpers.arrayElements(
    messageRows,
    Math.min(DELETED_MESSAGE_DEMO, messageRows.length),
  )) {
    row.deletedAt = faker.date.between({ from: row.createdAt!, to: now });
  }
  await prisma.message.createMany({ data: messageRows });
  console.log(
    `Done — ${messageRows.length} messages seeded across ${chattyRoomIds.length} rooms.`,
  );

  const friendshipStatuses = faker.helpers.shuffle(FRIENDSHIP_STATUS_PLAN);
  const usedPairs = new Set<string>();
  const friendshipRows: {
    status: FriendshipStatus;
    userAId: number;
    userBId: number;
    addresseeId: number;
  }[] = [];
  while (friendshipRows.length < friendshipStatuses.length) {
    const [a, b] = faker.helpers.arrayElements(userIds, 2);
    const pair = canonicalPair(a, b);
    const key = `${pair.userAId}-${pair.userBId}`;
    if (usedPairs.has(key)) continue;
    usedPairs.add(key);
    friendshipRows.push({
      status: friendshipStatuses[friendshipRows.length],
      ...pair,
      addresseeId: faker.datatype.boolean() ? pair.userAId : pair.userBId,
    });
  }
  await prisma.friendship.createMany({ data: friendshipRows });

  const jojoRequesters = await prisma.user.findMany({
    where: {
      id: {
        not: jojo.id,
        in: userIds.filter(
          (id) =>
            id !== jojo.id &&
            !usedPairs.has(`${Math.min(id, jojo.id)}-${Math.max(id, jojo.id)}`),
        ),
      },
    },
    select: { id: true, username: true },
    take: JOJO_PENDING_REQUESTS,
  });
  await prisma.friendship.createMany({
    data: jojoRequesters.map((requester) => ({
      status: FriendshipStatus.pending,
      ...canonicalPair(requester.id, jojo.id),
      addresseeId: jojo.id,
    })),
  });
  await prisma.notification.createMany({
    data: jojoRequesters.map((requester) => ({
      type: NotificationType.friend_request,
      content: `${requester.username} sent you a friend request.`,
      userId: jojo.id,
      actorId: requester.id,
    })),
  });
  console.log(
    `Done — ${jojoRequesters.length} pending friend requests seeded for jojo0.`,
  );

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
    options: { id: number; deletedAt: Date | null }[];
  }[] = [];
  let roomCursor = 0;
  let deletedDemoLeft = 2;

  for (let i = 0; i < pollTypes.length; i++) {
    const type = pollTypes[i];
    const status = pollStatuses[i];
    const room =
      activeRooms.length > 0 && i % 2 === 0
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
        text: '[deleted option]',
        order: optionRows.length,
        deletedAt: new Date(),
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
    bump(pollsCreated, createdById);
    pollRecords.push({
      id: poll.id,
      type,
      status,
      publishedAt,
      endsAt,
      roomId: room?.id ?? null,
      visibility,
      createdById,
      options: poll.options.map((o) => ({ id: o.id, deletedAt: o.deletedAt })),
    });
  }

  const pollHashtagRows: { pollId: number; hashtagId: number }[] = [];
  for (const poll of pollRecords) {
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

  const votablePolls = pollRecords;
  const hotPollIds = new Set(
    faker.helpers.arrayElements(
      votablePolls.map((p) => p.id),
      Math.min(HOT_POLL_COUNT, votablePolls.length),
    ),
  );
  for (const poll of votablePolls) {
    const liveOptions = poll.options.filter((o) => !o.deletedAt);
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
      const { optionIds, freeField } = pickVoteOptions(
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
          pollId: poll.id,
          createdById: voter.userId,
          freeField,
          createdAt,
          voteOptions: {
            create: optionIds.map((id) => ({ optionId: id })),
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

  try {
    const loaded = await pushKeysToRedis(issuedKeys);
    console.log(`Done — ${loaded} api key(s) loaded into redis.`);
  } catch (error) {
    console.error(`Could not load the keys into redis: ${String(error)}`);
    console.error('Restart the backend to have it restore them.');
  }

  reportApiAccounts(issuedKeys);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma?.$disconnect());
