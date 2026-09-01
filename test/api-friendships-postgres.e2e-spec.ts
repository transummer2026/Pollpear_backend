import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';
import { NotificationService } from '../src/notification/notification.service';
import { ApiFriendshipsService } from '../src/api/v1/friendships/friendships.service';
import { VaultService } from '../src/vault/vault.service';

const PREFIX = `if${Date.now().toString(36)}_`;

/**
 * What mocks cannot establish: that the uniqueness constraint on the pair
 * really holds, and that a withdrawn row is reopened rather than duplicated.
 * Notifications are replaced by doubles: this spec is about friendship rows,
 * not about what follows from them.
 */
describe('The friendship routes, against postgres', () => {
  let service: ApiFriendshipsService;
  let prisma: PrismaClient;

  let annaId = 0;
  let bobId = 0;
  let carlId = 0;

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

  const stored = (id: number) =>
    prisma.friendship.findUnique({
      where: { id },
      select: {
        userAId: true,
        userBId: true,
        addresseeId: true,
        status: true,
        deletedAt: true,
      },
    });

  beforeAll(async () => {
    const vault = new VaultService();
    await vault.init();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: vault.db.database_url }),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        ApiFriendshipsService,
        CaslAbilityFactory,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationService,
          useValue: {
            notifyFriendRequest: jest.fn(),
            notifyFriendAccepted: jest.fn(),
            clearFriendRequest: jest.fn(),
            clearFriendNotifications: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleFixture.get<ApiFriendshipsService>(ApiFriendshipsService);

    annaId = await addUser('anna');
    bobId = await addUser('bob');
    carlId = await addUser('carl');
  });

  afterAll(async () => {
    const mine = [annaId, bobId, carlId];
    await prisma.friendship.deleteMany({
      where: { OR: [{ userAId: { in: mine } }, { userBId: { in: mine } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: mine } } });
    await prisma.$disconnect();
  });

  const wipe = () =>
    prisma.friendship.deleteMany({
      where: {
        OR: [
          { userAId: { in: [annaId, bobId, carlId] } },
          { userBId: { in: [annaId, bobId, carlId] } },
        ],
      },
    });

  beforeEach(() => wipe());

  it('stores the pair in the canonical order, whoever asks first', async () => {
    const asked = await service.createFriendship(
      { addresseeId: annaId },
      asUser(bobId),
    );

    const [low, high] = [annaId, bobId].sort((a, b) => a - b);
    expect(await stored(asked.id)).toEqual({
      userAId: low,
      userBId: high,
      addresseeId: annaId,
      status: 'pending',
      deletedAt: null,
    });
  });

  it('answers a facing request instead of opening a second row', async () => {
    const first = await service.createFriendship(
      { addresseeId: bobId },
      asUser(annaId),
    );
    const second = await service.createFriendship(
      { addresseeId: annaId },
      asUser(bobId),
    );

    const rows = await prisma.friendship.count({
      where: { OR: [{ userAId: annaId }, { userBId: annaId }] },
    });

    expect(second.id).toBe(first.id);
    expect(second.status).toBe('accepted');
    expect(rows).toBe(1);
  });

  it('reopens the very row that was withdrawn', async () => {
    const first = await service.createFriendship(
      { addresseeId: bobId },
      asUser(annaId),
    );
    await service.removeFriendship(first.id, asUser(annaId));

    const again = await service.createFriendship(
      { addresseeId: bobId },
      asUser(annaId),
    );

    expect(again.id).toBe(first.id);
    expect(await stored(again.id)).toMatchObject({
      status: 'pending',
      deletedAt: null,
    });
  });

  it('keeps a pending request between two others out of sight', async () => {
    const hidden = await service.createFriendship(
      { addresseeId: bobId },
      asUser(annaId),
    );

    const seenByCarl = await service.findAllFriendships(
      { page: 1, limit: 50 },
      asUser(carlId),
    );

    expect(seenByCarl.data.map((row) => row.id)).not.toContain(hidden.id);
  });

  it('shows an accepted friendship to everyone it does not shut out', async () => {
    const made = await service.createFriendship(
      { addresseeId: bobId },
      asUser(annaId),
    );
    await service.updateFriendship(
      made.id,
      { status: 'accepted' },
      asUser(bobId),
    );

    const seenByCarl = await service.findAllFriendships(
      { page: 1, limit: 50, with: annaId },
      asUser(carlId),
    );

    expect(seenByCarl.data.map((row) => row.id)).toContain(made.id);
  });

  it('names the parties by their role, not by the stored order', async () => {
    const asked = await service.createFriendship(
      { addresseeId: annaId },
      asUser(bobId),
    );

    expect(asked.requester.id).toBe(bobId);
    expect(asked.addressee.id).toBe(annaId);
  });
});
