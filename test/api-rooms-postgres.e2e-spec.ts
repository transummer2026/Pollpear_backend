import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';
import { ApiRoomsService } from '../src/api/v1/rooms/rooms.service';
import { VaultService } from '../src/vault/vault.service';

const PREFIX = `ir${Date.now().toString(36)}_`;

/**
 * Ce que les mocks ne peuvent pas voir: la forme que postgres accepte
 * reellement. Le membre cree dans la meme ecriture que la room, et le compte
 * de sondages filtre par la politique, ne sont pas des formes que jest
 * valide - seul le moteur de requetes le fait.
 */
describe('The room routes, against postgres', () => {
  let service: ApiRoomsService;
  let prisma: PrismaClient;

  let ownerId = 0;
  let memberId = 0;
  let strangerId = 0;
  const roomIds: number[] = [];
  const pollIds: number[] = [];

  const asUser = (id: number) => ({ id, role: 'user' }) as User;

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

  const addPoll = async (roomId: number, visibility: 'public' | 'private') => {
    const poll = await prisma.poll.create({
      data: {
        title: `${PREFIX}${visibility}`,
        type: 'single_choice',
        visibility,
        allowChangeVote: true,
        isAnonymous: false,
        status: 'active',
        endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        createdById: ownerId,
        roomId,
      },
      select: { id: true },
    });
    pollIds.push(poll.id);
    return poll.id;
  };

  beforeAll(async () => {
    const vault = new VaultService();
    await vault.init();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: vault.db.database_url }),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        ApiRoomsService,
        CaslAbilityFactory,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleFixture.get<ApiRoomsService>(ApiRoomsService);

    ownerId = await addUser('owner');
    memberId = await addUser('member');
    strangerId = await addUser('stranger');
  });

  afterAll(async () => {
    await prisma.poll.deleteMany({ where: { id: { in: pollIds } } });
    await prisma.roomMember.deleteMany({ where: { roomId: { in: roomIds } } });
    await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, memberId, strangerId] } },
    });
    await prisma.$disconnect();
  });

  const createRoom = async (visibility: 'public' | 'private') => {
    const room = await service.createRoom(
      { name: `${PREFIX}${visibility}`, visibility },
      asUser(ownerId),
    );
    roomIds.push(room.id);
    return room;
  };

  it('seats the owner as a member in the same write as the room', async () => {
    const room = await createRoom('public');

    const members = await prisma.roomMember.findMany({
      where: { roomId: room.id },
      select: { userId: true, deletedAt: true },
    });

    expect(members).toEqual([{ userId: ownerId, deletedAt: null }]);
    expect(room.memberCount).toBe(1);
  });

  it('opens the room active, on the default banner, with no poll yet', async () => {
    const room = await createRoom('public');

    expect(room).toMatchObject({
      status: 'active',
      bannerUrl: '/uploads/banners/default.svg',
      pollCount: 0,
      createdBy: { id: ownerId },
    });
  });

  it('counts the polls the caller may read, not every poll of the room', async () => {
    const room = await createRoom('public');
    await addPoll(room.id, 'public');
    await addPoll(room.id, 'private');

    const forOwner = await service.findOneRoom(room.id, asUser(ownerId));
    const forStranger = await service.findOneRoom(room.id, asUser(strangerId));

    expect(forOwner.pollCount).toBe(2);
    expect(forStranger.pollCount).toBe(1);
  });

  it('keeps a private room out of a stranger list, and in its members one', async () => {
    const room = await createRoom('private');
    await prisma.roomMember.create({
      data: { roomId: room.id, userId: memberId, joinedAt: new Date() },
    });

    const named = async (id: number) =>
      (await service.findAllRooms({ page: 1, limit: 50 }, asUser(id))).data
        .map((row) => row.name)
        .filter((name) => name.startsWith(PREFIX));

    expect(await named(memberId)).toContain(room.name);
    expect(await named(strangerId)).not.toContain(room.name);
  });

  it('404s a private room to a stranger asking for it by id', async () => {
    const room = await createRoom('private');

    await expect(
      service.findOneRoom(room.id, asUser(strangerId)),
    ).rejects.toThrow('Room not found');
  });

  it('stops serving a room once it is deleted', async () => {
    const room = await createRoom('public');

    await service.removeRoom(room.id, asUser(ownerId));

    await expect(service.findOneRoom(room.id, asUser(ownerId))).rejects.toThrow(
      'Room not found',
    );
  });
  it('closes a room past its deadline on the next read, and stores the flip', async () => {
    const room = await createRoom('public');

    await prisma.room.update({
      where: { id: room.id },
      data: { endsAt: new Date(Date.now() - 1000) },
    });

    const seen = await service.findOneRoom(room.id, asUser(ownerId));
    const stored = await prisma.room.findUnique({
      where: { id: room.id },
      select: { status: true },
    });

    expect(seen.status).toBe('closed');
    expect(stored).toEqual({ status: 'closed' });
  });
});
