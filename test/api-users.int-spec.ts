import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { visibleTo } from '../src/api/v1/users/users.visibility';
import { viewerAs } from '../src/api/v1/common/viewer.mock';

/**
 * The one question the e2e suites cannot answer: they assert the where clause
 * the service hands to Prisma, never the rows postgres hands back. Here the
 * real filter runs against a real database, on rows this file creates and
 * removes, so what is being checked is the translation into SQL: that a
 * private account is genuinely absent, and that a ban lifted before its term
 * genuinely stops hiding its owner.
 *
 * Needs a database and TEST_DATABASE_URL pointing at it, migrations applied;
 * without it the suite skips rather than failing, the same way the e2e suites
 * stay out of CI. A throwaway container is enough:
 *
 *   docker run -d --name pg-int -p 55432:5432 \
 *     -e POSTGRES_USER=int -e POSTGRES_PASSWORD=int -e POSTGRES_DB=int \
 *     postgres:16-alpine
 *   docker exec -i pg-int psql -U int -d int \
 *     < prisma/migrations/*_init/migration.sql
 *   TEST_DATABASE_URL=postgresql://int:int@localhost:55432/int npm run test:int
 *
 * Every row it writes is prefixed, and dropped in afterAll: pointing this at
 * a shared database costs it six users and three bans for the length of a run.
 */
const url = process.env.TEST_DATABASE_URL;
const describeWithDb = url ? describe : describe.skip;

if (!url) {
  console.warn(
    'TEST_DATABASE_URL is not set: the SQL level checks were skipped.',
  );
}

const PREFIX = `iv${Date.now().toString(36)}_`;
const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000);
const PAST = new Date(Date.now() - 7 * 24 * 3600 * 1000);

const stranger = viewerAs(0, 'user');
const moderator = viewerAs(0, 'moderator');
const admin = viewerAs(0, 'admin');

describeWithDb('The visibility filter, against postgres', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  const ids: Record<string, number> = {};

  const addUser = async (
    key: string,
    over: { visibility?: 'private'; deletedAt?: Date } = {},
  ) => {
    const user = await prisma.user.create({
      data: {
        username: `${PREFIX}${key}`,
        email: `${PREFIX}${key}@example.test`,
        birthdate: new Date('1990-01-01'),
        passwordHash: 'not-a-real-hash',
        gender: 'other',
        nationality: 'testland',
        ...over,
      },
      select: { id: true },
    });
    ids[key] = user.id;
    return user.id;
  };

  const addBan = (
    userId: number,
    over: { endedAt?: Date; unbannedById?: number } = {},
  ) =>
    prisma.ban.create({
      data: {
        banReason: 'integration check',
        startedAt: PAST,
        endedAt: FUTURE,
        userId,
        bannedById: ids.listed,
        ...over,
      },
    });

  /** Only the accounts this suite created, so a populated database cannot skew the answer. */
  const listedFor = async (viewer: ReturnType<typeof viewerAs>) => {
    const rows = await prisma.user.findMany({
      where: {
        AND: [visibleTo(viewer), { username: { startsWith: PREFIX } }],
      },
      select: { username: true },
    });
    return rows.map((row) => row.username.slice(PREFIX.length)).sort();
  };

  beforeAll(async () => {
    await addUser('listed');
    await addUser('hidden', { visibility: 'private' });
    await addUser('gone', { deletedAt: new Date() });
    const banned = await addUser('banned');
    const pardoned = await addUser('pardoned');
    const served = await addUser('served');

    await addBan(banned);
    await addBan(pardoned, { unbannedById: ids.listed });
    await addBan(served, { endedAt: PAST });
  });

  afterAll(async () => {
    const mine = Object.values(ids);
    await prisma.ban.deleteMany({ where: { userId: { in: mine } } });
    await prisma.user.deleteMany({ where: { id: { in: mine } } });
    await prisma.$disconnect();
  });

  it('keeps a private account out, whoever is asking', async () => {
    for (const viewer of [stranger, moderator, admin]) {
      expect(await listedFor(viewer)).not.toContain('hidden');
    }
  });

  it('hides the deleted and the banned from an ordinary caller', async () => {
    expect(await listedFor(stranger)).toEqual(['listed', 'pardoned', 'served']);
  });

  it('still lists someone whose ban a moderator lifted before its term', async () => {
    expect(await listedFor(stranger)).toContain('pardoned');
  });

  it('lists someone whose ban simply ran out', async () => {
    expect(await listedFor(stranger)).toContain('served');
  });

  it('shows the banned to a moderator, and nothing more', async () => {
    expect(await listedFor(moderator)).toEqual([
      'banned',
      'listed',
      'pardoned',
      'served',
    ]);
  });

  it('shows the deleted to an admin, and nothing more', async () => {
    expect(await listedFor(admin)).toEqual([
      'banned',
      'gone',
      'listed',
      'pardoned',
      'served',
    ]);
  });

  it('answers nothing at all for a private profile, which is the 404', async () => {
    const found = await prisma.user.findFirst({
      where: { id: ids.hidden, ...visibleTo(stranger) },
      select: { id: true },
    });

    expect(found).toBeNull();
  });

  it('answers the row for a listed profile, same query', async () => {
    const found = await prisma.user.findFirst({
      where: { id: ids.listed, ...visibleTo(stranger) },
      select: { id: true },
    });

    expect(found).toEqual({ id: ids.listed });
  });
});
